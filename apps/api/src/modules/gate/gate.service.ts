import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { Repository, MoreThan } from "typeorm";
import Redis from "ioredis";
import { Ticket, GateScan } from "@urticketbuddy/db";
import {
  ScanResult,
  TicketStatus,
  ErrorCode,
  GateScanResponse,
  GateMetricsResponse,
  GateScanRequestSchema,
} from "@urticketbuddy/contracts";
import {
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  REDIS_CLIENT,
} from "../../database/database.tokens";
import { BloomService } from "../../common/bloom/bloom.service";
import { TicketsService } from "../tickets/tickets.service";
import { ScanTicketDto } from "./dto/scan-ticket.dto";

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(GATE_SCAN_REPOSITORY)
    private readonly gateScanRepository: Repository<GateScan>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly bloomService: BloomService,
    private readonly ticketsService: TicketsService,
  ) {}

  /**
   * Helper to persist a gate scan audit record.
   */
  async recordScan(params: {
    ticketId: string | null;
    eventId: string;
    scannedBy: string;
    result: ScanResult;
  }): Promise<GateScan> {
    try {
      const scan = this.gateScanRepository.create({
        ticketId: params.ticketId,
        eventId: params.eventId,
        scannedBy: params.scannedBy,
        result: params.result,
        scannedAt: new Date(),
      });
      return await this.gateScanRepository.save(scan);
    } catch (err) {
      this.logger.error(
        `Failed to record gate scan audit: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Return a pseudo record if database insert fails
      return {
        id: "audit-failed",
        ticketId: params.ticketId,
        eventId: params.eventId,
        scannedBy: params.scannedBy,
        result: params.result,
        scannedAt: new Date(),
      } as GateScan;
    }
  }

  /**
   * Scans and validates a dynamic QR token at the gate.
   *
   * Multi-stage pipeline:
   * 1. Decode token payload
   * 2. RedisBloom prefilter check (rejects forged/unregistered tokens with ZERO PostgreSQL queries)
   * 3. PostgreSQL ticket lookup & event verification
   * 4. Cryptographic HMAC & time window verification
   * 5. Redis replay protection (`qr_nonce:<ticketId>:<window>`)
   * 6. Atomic conditional update (ISSUED -> CHECKED_IN)
   */
  async scanTicket(
    dto: ScanTicketDto,
    scannedBy: string,
  ): Promise<GateScanResponse> {
    const parsed = GateScanRequestSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid gate scan request payload",
        details: parsed.error.issues,
      });
    }

    const { token, eventId } = parsed.data;

    // 1. Decode token payload
    let ticketId: string;
    let windowStr: string;
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token segment count");
      }
      [ticketId, windowStr] = parts;
      if (!ticketId || !windowStr) {
        throw new Error("Missing ticketId or window");
      }
    } catch {
      await this.recordScan({
        ticketId: null,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_INVALID,
        message: "Malformed QR token structure",
      });
    }

    // 2. RedisBloom prefilter check
    // Reject definite non-existent/forged tickets WITHOUT querying PostgreSQL
    const mightExist = await this.bloomService.mightExist(ticketId);
    if (!mightExist) {
      this.logger.warn(
        `Bloom prefilter rejected forged/unknown ticketId ${ticketId} without querying PostgreSQL.`,
      );
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: "Invalid or forged ticket",
      });
    }

    // 3. PostgreSQL ticket lookup
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: "Ticket not found in system",
      });
    }

    // 4. Verify event match
    if (ticket.eventId !== eventId) {
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result: ScanResult.WRONG_EVENT,
      });
      throw new BadRequestException({
        code: ErrorCode.WRONG_EVENT,
        message: "Ticket is not valid for this event",
      });
    }

    // 5. Cryptographic signature and window verification
    const verification = this.ticketsService.verifyToken(token, ticket);
    if (!verification.valid) {
      const result = verification.isExpired
        ? ScanResult.EXPIRED
        : ScanResult.INVALID;
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result,
      });
      throw new BadRequestException({
        code: verification.isExpired
          ? ErrorCode.TICKET_EXPIRED
          : ErrorCode.TICKET_INVALID,
        message: verification.reason || "Token verification failed",
      });
    }

    // 6. Redis replay protection (qr_nonce:<ticketId>:<window> = SET NX EX 60)
    const nonceKey = `qr_nonce:${ticketId}:${verification.window}`;
    const nonceAcquired = await this.redisClient.set(
      nonceKey,
      "1",
      "EX",
      60,
      "NX",
    );

    if (!nonceAcquired) {
      this.logger.warn(
        `Replay attack detected for ticket ${ticketId} in window ${verification.window}`,
      );
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result: ScanResult.USED,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_ALREADY_USED,
        message: "Ticket QR token was already scanned (replay detected)",
      });
    }

    // 7. Atomic conditional update (ISSUED -> CHECKED_IN)
    const updateRes = await this.ticketRepository.update(
      { id: ticketId, status: TicketStatus.ISSUED },
      { status: TicketStatus.CHECKED_IN },
    );

    if (!updateRes.affected || updateRes.affected === 0) {
      await this.recordScan({
        ticketId,
        eventId,
        scannedBy,
        result: ScanResult.USED,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_ALREADY_USED,
        message: `Ticket is not in ISSUED state (current status: ${ticket.status})`,
      });
    }

    // 8. Record valid gate scan audit
    const scan = await this.recordScan({
      ticketId,
      eventId,
      scannedBy,
      result: ScanResult.VALID,
    });

    this.logger.log(
      `Ticket ${ticketId} successfully checked in at gate by ${scannedBy}`,
    );

    return {
      scanId: scan.id,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      result: ScanResult.VALID,
      scannedAt: scan.scannedAt.toISOString(),
      message: "Ticket checked in successfully",
      seatId: ticket.eventSeatId,
    };
  }

  /**
   * Calculates entry metrics for an event.
   */
  async getMetrics(eventId: string): Promise<GateMetricsResponse> {
    const totalScans = await this.gateScanRepository.count({
      where: { eventId },
    });

    const validScans = await this.gateScanRepository.count({
      where: { eventId, result: ScanResult.VALID },
    });

    const rejectedScans = totalScans - validScans;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentScans = await this.gateScanRepository.count({
      where: {
        eventId,
        scannedAt: MoreThan(fiveMinutesAgo),
      },
    });

    const entryVelocityPerMinute = Math.round((recentScans / 5) * 100) / 100;

    return {
      eventId,
      totalScans,
      validScans,
      rejectedScans,
      entryVelocityPerMinute,
    };
  }
}

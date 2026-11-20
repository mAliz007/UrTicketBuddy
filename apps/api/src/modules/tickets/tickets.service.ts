import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import { Ticket } from "@urticketbuddy/db";
import { loadEnv } from "@urticketbuddy/config";
import {
  TicketStatus,
  UserRole,
  ErrorCode,
  DynamicQrResponse,
} from "@urticketbuddy/contracts";
import { TICKET_REPOSITORY } from "../../database/database.tokens";

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly masterTicketSecret: string;

  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
  ) {
    const env = loadEnv();
    this.masterTicketSecret = env.MASTER_TICKET_SECRET;
  }

  /**
   * Derives a cryptographic key for a specific ticket and seedVersion using HKDF-SHA256 (Decision D-3).
   * Key = HKDF(MASTER_TICKET_SECRET, ticketId + seed_version), length = 32 bytes.
   */
  deriveKey(ticketId: string, seedVersion: number): Buffer {
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from(this.masterTicketSecret),
        Buffer.alloc(0),
        Buffer.from(`${ticketId}:${seedVersion}`),
        32,
      ),
    );
  }

  /**
   * Generates a 30-second time-decaying dynamic QR token (Decision D-3).
   * Token payload: base64url(ticketId.window.hmac)
   */
  generateDynamicToken(
    ticketId: string,
    seedVersion: number,
    timestampMs: number = Date.now(),
  ): { token: string; expiresAt: string; window: number } {
    const window = Math.floor(timestampMs / 1000 / 30);
    const derivedKey = this.deriveKey(ticketId, seedVersion);
    const hmac = crypto
      .createHmac("sha256", derivedKey)
      .update(`${ticketId}:${window}`)
      .digest("base64url");

    const rawPayload = `${ticketId}.${window}.${hmac}`;
    const token = Buffer.from(rawPayload, "utf8").toString("base64url");
    const windowEndMs = (window + 1) * 30 * 1000;

    return {
      token,
      expiresAt: new Date(windowEndMs).toISOString(),
      window,
    };
  }

  /**
   * Constant-time verification of a dynamic QR token.
   * Tolerates 1 window of clock skew [currentWindow - 1, currentWindow].
   */
  verifyToken(
    token: string,
    ticket: Ticket,
    currentTimestampMs: number = Date.now(),
  ): { valid: boolean; reason?: string; window?: number; isExpired?: boolean } {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(".");
      if (parts.length !== 3) {
        return { valid: false, reason: "Malformed token structure" };
      }

      const [tokenTicketId, windowStr, tokenHmac] = parts;
      if (tokenTicketId !== ticket.id) {
        return { valid: false, reason: "Ticket ID mismatch" };
      }

      const tokenWindow = parseInt(windowStr, 10);
      if (isNaN(tokenWindow)) {
        return { valid: false, reason: "Invalid window in token" };
      }

      const currentWindow = Math.floor(currentTimestampMs / 1000 / 30);

      // Verify window validity: strictly accept currentWindow and currentWindow - 1 (Decision D-3)
      if (tokenWindow < currentWindow - 1 || tokenWindow > currentWindow) {
        return {
          valid: false,
          reason:
            tokenWindow < currentWindow - 1
              ? "Token window expired"
              : "Token window from future",
          window: tokenWindow,
          isExpired: true,
        };
      }

      const derivedKey = this.deriveKey(ticket.id, ticket.seedVersion);
      const expectedHmac = crypto
        .createHmac("sha256", derivedKey)
        .update(`${ticket.id}:${tokenWindow}`)
        .digest("base64url");

      const expectedBuf = Buffer.from(expectedHmac, "utf8");
      const tokenHmacBuf = Buffer.from(tokenHmac, "utf8");

      if (
        expectedBuf.length !== tokenHmacBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, tokenHmacBuf)
      ) {
        return { valid: false, reason: "HMAC signature mismatch" };
      }

      return { valid: true, window: tokenWindow };
    } catch {
      return { valid: false, reason: "Token decode error" };
    }
  }

  /**
   * Retrieves a dynamic QR token for a ticket, enforcing caller ownership and ISSUED state.
   */
  async getDynamicQr(
    ticketId: string,
    user: { id?: string; userId?: string; role: string },
  ): Promise<DynamicQrResponse> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: `Ticket ${ticketId} not found`,
      });
    }

    const callerId = user.id || user.userId;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAdmin && ticket.ownerId !== callerId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "You do not own this ticket",
      });
    }

    if (ticket.status !== TicketStatus.ISSUED) {
      throw new BadRequestException({
        code: ErrorCode.TICKET_ALREADY_USED,
        message: `Ticket cannot generate QR token in ${ticket.status} status`,
      });
    }

    const { token, expiresAt } = this.generateDynamicToken(
      ticket.id,
      ticket.seedVersion,
    );

    return {
      ticketId: ticket.id,
      token,
      expiresAt,
      windowSeconds: 30,
    };
  }

  /**
   * Rotates the cryptographic seed version of a ticket.
   * Immediately invalidates all previously generated tokens (Decision D-3).
   */
  async rotateKey(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: `Ticket ${ticketId} not found`,
      });
    }

    await this.ticketRepository.increment({ id: ticketId }, "seedVersion", 1);
    const updated = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });
    this.logger.log(
      `Rotated seed version for ticket ${ticketId} to ${updated!.seedVersion}`,
    );
    return updated!;
  }

  /**
   * Lists all tickets belonging to the authenticated user.
   */
  async getUserTickets(userId: string): Promise<Ticket[]> {
    return await this.ticketRepository.find({
      where: { ownerId: userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Finds a ticket by ID.
   */
  async findById(ticketId: string): Promise<Ticket | null> {
    return await this.ticketRepository.findOne({
      where: { id: ticketId },
    });
  }
}

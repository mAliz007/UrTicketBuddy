import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import Redis from "ioredis";
import { ErrorCode, HoldRequest, HoldResponse } from "@urticketbuddy/contracts";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import {
  CHECKOUT_REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "./checkout.tokens";

export interface SeatUpdatePubSubPayload {
  eventId: string;
  seatIds: string[];
  state: "HELD" | "SOLD" | "RELEASED" | "AVAILABLE";
  userId: string;
  expiresAt?: number;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(CHECKOUT_REDIS_CLIENT)
    private readonly redis: Redis,
    @Inject(REDIS_SCRIPTS_WRAPPER)
    private readonly redisScripts: RedisScriptsWrapper,
  ) {}

  async holdSeats(userId: string, request: HoldRequest): Promise<HoldResponse> {
    const result = await this.redisScripts.holdSeats({
      eventId: request.eventId,
      userId,
      seatIds: request.seatIds,
      ttlSeconds: request.ttlSeconds,
      maxPerUser: request.maxPerUser,
    });

    if (!result.success || !result.expiresAt) {
      const code = result.code || ErrorCode.SEAT_ALREADY_HELD;
      this.logger.warn(
        `Seat hold rejected for event=${request.eventId} user=${userId} code=${code}`,
      );
      throw new HttpException(
        {
          code,
          message: `Unable to hold seats: ${code}`,
          details: {
            conflictingSeats: result.conflictingSeats,
          },
        },
        HttpStatus.CONFLICT,
      );
    }

    const payload: SeatUpdatePubSubPayload = {
      eventId: request.eventId,
      seatIds: result.seatIds,
      state: "HELD",
      userId,
      expiresAt: result.expiresAt,
    };

    await this.redis.publish("seat.state", JSON.stringify(payload));
    this.logger.log(
      `Held ${result.seatIds.length} seat(s) for event=${request.eventId} user=${userId}`,
    );

    return {
      eventId: request.eventId,
      userId,
      seatIds: result.seatIds,
      expiresAt: result.expiresAt,
    };
  }

  async releaseSeats(
    userId: string,
    eventId: string,
    seatIds: string[],
  ): Promise<{
    eventId: string;
    userId: string;
    seatIds: string[];
    state: "AVAILABLE";
  }> {
    let releasedSeats = seatIds;
    if (typeof this.redisScripts.releaseSeats === "function") {
      const result = await this.redisScripts.releaseSeats(
        eventId,
        userId,
        seatIds,
      );
      const resObj = result as {
        success?: boolean;
        ok?: boolean;
        code?: string;
        releasedSeats?: string[];
        seatIds?: string[];
        failedSeats?: string[];
      };

      if (resObj && resObj.success === false && resObj.ok === false) {
        const code = resObj.code || ErrorCode.SEAT_NOT_HELD_BY_YOU;
        throw new HttpException(
          {
            code,
            message: `Unable to release seats: ${code}`,
            details: {
              failedSeats: resObj.failedSeats || [],
            },
          },
          HttpStatus.CONFLICT,
        );
      }
      releasedSeats = resObj.releasedSeats || resObj.seatIds || seatIds;
    }

    const payload: SeatUpdatePubSubPayload = {
      eventId,
      seatIds: releasedSeats,
      state: "AVAILABLE",
      userId,
    };

    await this.redis.publish("seat.state", JSON.stringify(payload));
    this.logger.log(
      `Released ${releasedSeats.length} seat(s) for event=${eventId} user=${userId}`,
    );

    return {
      eventId,
      userId,
      seatIds: releasedSeats,
      state: "AVAILABLE",
    };
  }

  async getSeatsState(eventId: string): Promise<{
    eventId: string;
    holds: Record<string, unknown>;
    sold: string[];
    counts: { held: number; sold: number };
  }> {
    let holds: Record<string, unknown> = {};
    let sold: string[] = [];
    if (typeof this.redisScripts.getSnapshot === "function") {
      const snapshot = (await this.redisScripts.getSnapshot(
        eventId,
      )) as unknown as {
        holds?: Record<string, unknown>;
        held?: Record<string, unknown>;
        sold?: string[];
        soldSeats?: string[];
      };
      holds = snapshot?.holds || snapshot?.held || {};
      sold = snapshot?.sold || snapshot?.soldSeats || [];
    }

    let counts = {
      held: Object.keys(holds).length,
      sold: sold.length,
    };
    if (typeof this.redisScripts.getCounts === "function") {
      const rawCounts = (await this.redisScripts.getCounts(eventId)) as {
        held?: number;
        heldCount?: number;
        sold?: number;
        soldCount?: number;
      };
      if (rawCounts) {
        counts = {
          held: rawCounts.held ?? rawCounts.heldCount ?? counts.held,
          sold: rawCounts.sold ?? rawCounts.soldCount ?? counts.sold,
        };
      }
    }

    return {
      eventId,
      holds,
      sold,
      counts,
    };
  }
}

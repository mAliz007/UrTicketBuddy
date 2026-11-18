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
  state: "HELD" | "SOLD" | "RELEASED";
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

    const channel = `seat-updates:${request.eventId}`;
    const payload: SeatUpdatePubSubPayload = {
      eventId: request.eventId,
      seatIds: result.seatIds,
      state: "HELD",
      userId,
      expiresAt: result.expiresAt,
    };

    await this.redis.publish(channel, JSON.stringify(payload));
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
}

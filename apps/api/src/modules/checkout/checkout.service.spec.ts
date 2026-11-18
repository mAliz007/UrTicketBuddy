import { HttpException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ErrorCode } from "@urticketbuddy/contracts";
import { CheckoutService } from "./checkout.service";
import {
  CHECKOUT_REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "./checkout.tokens";

describe("CheckoutService", () => {
  let service: CheckoutService;
  const mockRedis = {
    publish: jest.fn().mockResolvedValue(1),
  };
  const mockRedisScripts = {
    holdSeats: jest.fn(),
  };

  const eventId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const seatIds = ["sec1-A-1", "sec1-A-2"];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: CHECKOUT_REDIS_CLIENT, useValue: mockRedis },
        { provide: REDIS_SCRIPTS_WRAPPER, useValue: mockRedisScripts },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  it("holds seats, publishes to Redis Pub/Sub, and returns expiresAt", async () => {
    const expiresAt = Date.now() + 600_000;
    mockRedisScripts.holdSeats.mockResolvedValue({
      success: true,
      ok: true,
      code: "OK",
      expiresAt,
      seatIds,
      conflictingSeats: [],
      conflicts: [],
    });

    const result = await service.holdSeats(userId, { eventId, seatIds });

    expect(mockRedisScripts.holdSeats).toHaveBeenCalledWith({
      eventId,
      userId,
      seatIds,
      ttlSeconds: undefined,
      maxPerUser: undefined,
    });
    expect(mockRedis.publish).toHaveBeenCalledWith(
      `seat-updates:${eventId}`,
      JSON.stringify({
        eventId,
        seatIds,
        state: "HELD",
        userId,
      }),
    );
    expect(result).toEqual({
      eventId,
      userId,
      seatIds,
      expiresAt,
    });
  });

  it("throws 409 Conflict when seats are already held", async () => {
    mockRedisScripts.holdSeats.mockResolvedValue({
      success: false,
      ok: false,
      code: ErrorCode.SEAT_ALREADY_HELD,
      seatIds: [],
      conflictingSeats: ["sec1-A-1"],
      conflicts: ["sec1-A-1"],
    });

    await expect(
      service.holdSeats(userId, { eventId, seatIds }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    expect(mockRedis.publish).not.toHaveBeenCalled();

    try {
      await service.holdSeats(userId, { eventId, seatIds });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(response.code).toBe(ErrorCode.SEAT_ALREADY_HELD);
    }
  });
});

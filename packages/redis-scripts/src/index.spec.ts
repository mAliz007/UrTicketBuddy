import Redis from "ioredis";
import {
  HOLD_SEATS_LUA,
  RELEASE_SEATS_LUA,
  CONFIRM_SOLD_LUA,
  UNSELL_SEATS_LUA,
  EXTEND_HOLD_LUA,
  EXPIRE_DUE_LUA,
  RedisKeys,
  RedisScriptsWrapper,
} from "./index";

describe("packages/redis-scripts (unit)", () => {
  it("should load all 6 Lua script files with expected commands and error codes", () => {
    expect(HOLD_SEATS_LUA).toContain("SEAT_ALREADY_HELD");
    expect(HOLD_SEATS_LUA).toContain("TOO_MANY_SEATS");
    expect(RELEASE_SEATS_LUA).toContain("SEAT_NOT_HELD_BY_YOU");
    expect(CONFIRM_SOLD_LUA).toContain("SEAT_NOT_HELD_BY_YOU");
    expect(CONFIRM_SOLD_LUA).toContain("HOLD_EXPIRED");
    expect(UNSELL_SEATS_LUA).toContain("SREM");
    expect(EXTEND_HOLD_LUA).toContain("HOLD_ALREADY_EXTENDED");
    expect(EXPIRE_DUE_LUA).toContain("ZRANGE");
  });

  it("should format Redis keys with {eventId} hash tags for single-slot affinity", () => {
    const eventId = "123e4567-e89b-12d3-a456-426614174000";
    const userId = "987e6543-e21b-12d3-a456-426614174000";
    expect(RedisKeys.seatLock(eventId, "A-1-1")).toBe(
      `seat_lock:{${eventId}}:A-1-1`,
    );
    expect(RedisKeys.seatSold(eventId)).toBe(`seat_sold:{${eventId}}`);
    expect(RedisKeys.holdExpiry(eventId)).toBe(`hold_expiry:{${eventId}}`);
    expect(RedisKeys.userHolds(eventId, userId)).toBe(
      `user_holds:{${eventId}}:${userId}`,
    );
    expect(RedisKeys.holdExtended(eventId, userId)).toBe(
      `hold_extended:{${eventId}}:${userId}`,
    );
  });

  it("should register all 6 Lua scripts via ioredis defineCommand", () => {
    const mockRedis = {
      defineCommand: jest.fn(),
    } as unknown as Redis;

    const wrapper = new RedisScriptsWrapper(mockRedis);
    expect(wrapper).toBeDefined();

    const expectedCommands = [
      "hold_seats",
      "release_seats",
      "confirm_sold",
      "unsell_seats",
      "extend_hold",
      "expire_due",
    ];

    for (const cmd of expectedCommands) {
      expect(mockRedis.defineCommand).toHaveBeenCalledWith(
        cmd,
        expect.objectContaining({
          numberOfKeys: expect.any(Number),
          lua: expect.any(String),
        }),
      );
    }
  });
});

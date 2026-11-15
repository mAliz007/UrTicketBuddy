import Redis from "ioredis";

export interface SeatHoldParams {
  eventId: string;
  seatId: string;
  userId: string;
  ttlSeconds?: number;
}

export interface SeatHoldResult {
  success: boolean;
  code: string;
}

export const SEAT_HOLD_LUA = `
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
    return {0, 'SEAT_ALREADY_SOLD'}
end
local acquired = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[3]))
if not acquired then
    return {0, 'SEAT_ALREADY_HELD'}
end
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[2])
redis.call('SADD', KEYS[4], ARGV[2])
return {1, 'OK'}
`;

export class RedisScriptsWrapper {
  constructor(private readonly redis: Redis) {
    this.redis.defineCommand("atomicSeatHold", {
      numberOfKeys: 4,
      lua: SEAT_HOLD_LUA,
    });
  }

  async holdSeat(params: SeatHoldParams): Promise<SeatHoldResult> {
    const { eventId, seatId, userId, ttlSeconds = 600 } = params;
    const lockKey = `seat_lock:{${eventId}}:${seatId}`;
    const soldKey = `seat_sold:{${eventId}}`;
    const expiryKey = `hold_expiry:{${eventId}}`;
    const userHoldsKey = `user_holds:{${eventId}}:${userId}`;
    const expiryTimestampMs = Date.now() + ttlSeconds * 1000;

    // Call defined Lua script
    const res = (await (
      this.redis as unknown as Record<string, Function>
    ).atomicSeatHold(
      lockKey,
      soldKey,
      expiryKey,
      userHoldsKey,
      userId,
      seatId,
      ttlSeconds,
      expiryTimestampMs,
    )) as [number, string];

    return {
      success: res[0] === 1,
      code: res[1],
    };
  }
}

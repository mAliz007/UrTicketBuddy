import * as fs from "fs";
import * as path from "path";
import Redis, { Result } from "ioredis";
import { ErrorCode } from "@urticketbuddy/contracts";

const LUA_DIR = path.resolve(__dirname, "../lua");

function loadLuaScript(filename: string): string {
  return fs.readFileSync(path.join(LUA_DIR, filename), "utf8");
}

export const HOLD_SEATS_LUA = loadLuaScript("hold_seats.lua");
export const RELEASE_SEATS_LUA = loadLuaScript("release_seats.lua");
export const CONFIRM_SOLD_LUA = loadLuaScript("confirm_sold.lua");
export const UNSELL_SEATS_LUA = loadLuaScript("unsell_seats.lua");
export const EXTEND_HOLD_LUA = loadLuaScript("extend_hold.lua");
export const EXPIRE_DUE_LUA = loadLuaScript("expire_due.lua");

export const SEAT_HOLD_LUA = HOLD_SEATS_LUA;

export const DEFAULT_HOLD_TTL_SECONDS = 600;
export const DEFAULT_MAX_SEATS_PER_USER = 6;
export const DEFAULT_EXTEND_GRACE_SECONDS = 120;

export const RedisKeys = {
  seatLock: (eventId: string, seatId: string): string =>
    `seat_lock:{${eventId}}:${seatId}`,
  seatSold: (eventId: string): string => `seat_sold:{${eventId}}`,
  holdExpiry: (eventId: string): string => `hold_expiry:{${eventId}}`,
  userHolds: (eventId: string, userId: string): string =>
    `user_holds:{${eventId}}:${userId}`,
  holdExtended: (eventId: string, userId: string): string =>
    `hold_extended:{${eventId}}:${userId}`,
} as const;

export type LuaHoldRawTuple = [number, string, string | string[], string[]?];
export type LuaStatusRawTuple = [number, string, string[]];
export type LuaExtendRawTuple = [number, string, string | string[], string[]?];

declare module "ioredis" {
  interface RedisCommander<Context> {
    hold_seats(
      soldKey: string,
      holdExpiryKey: string,
      userHoldsKey: string,
      eventId: string,
      userId: string,
      ttlSeconds: number | string,
      maxPerUser: number | string,
      nowMs: number | string,
      ...seatIds: string[]
    ): Result<LuaHoldRawTuple, Context>;

    release_seats(
      holdExpiryKey: string,
      userHoldsKey: string,
      eventId: string,
      userId: string,
      ...seatIds: string[]
    ): Result<LuaStatusRawTuple, Context>;

    confirm_sold(
      soldKey: string,
      holdExpiryKey: string,
      userHoldsKey: string,
      eventId: string,
      userId: string,
      nowMs: number | string,
      ...seatIds: string[]
    ): Result<LuaStatusRawTuple, Context>;

    unsell_seats(
      soldKey: string,
      eventId: string,
      ...seatIds: string[]
    ): Result<LuaStatusRawTuple, Context>;

    extend_hold(
      holdExpiryKey: string,
      userHoldsKey: string,
      holdExtendedKey: string,
      eventId: string,
      userId: string,
      graceSeconds: number | string,
      nowMs: number | string,
      ...seatIds: string[]
    ): Result<LuaExtendRawTuple, Context>;

    expire_due(
      holdExpiryKey: string,
      eventId: string,
      nowMs: number | string,
    ): Result<string[], Context>;
  }
}

export interface HoldSeatsParams {
  eventId: string;
  userId: string;
  seatIds: string[];
  ttlSeconds?: number;
  maxPerUser?: number;
  nowMs?: number;
}

export interface HoldSeatsResult {
  success: boolean;
  ok: boolean;
  code: "OK" | ErrorCode | string;
  expiresAt?: number;
  seatIds: string[];
  conflictingSeats: string[];
  conflicts: string[];
}

export interface ReleaseSeatsParams {
  eventId: string;
  userId: string;
  seatIds: string[];
}

export interface ReleaseSeatsResult {
  success: boolean;
  ok: boolean;
  code: "OK" | ErrorCode | string;
  releasedSeats: string[];
  seatIds: string[];
  conflictingSeats: string[];
}

export interface ConfirmSoldParams {
  eventId: string;
  userId: string;
  seatIds: string[];
  nowMs?: number;
}

export interface ConfirmSoldResult {
  success: boolean;
  ok: boolean;
  code: "OK" | ErrorCode | string;
  soldSeats: string[];
  seatIds: string[];
  failedSeats: string[];
}

export interface UnsellSeatsParams {
  eventId: string;
  seatIds: string[];
}

export interface UnsellSeatsResult {
  success: boolean;
  ok: boolean;
  code: "OK";
  unsoldSeats: string[];
  seatIds: string[];
}

export interface ExtendHoldParams {
  eventId: string;
  userId: string;
  seatIds?: string[];
  graceSeconds?: number;
  nowMs?: number;
}

export interface ExtendHoldResult {
  success: boolean;
  ok: boolean;
  code: "OK" | ErrorCode | "HOLD_ALREADY_EXTENDED" | string;
  expiresAt?: number;
  seatIds: string[];
  failedSeats: string[];
}

export interface SeatSnapshot {
  eventId: string;
  held: string[];
  sold: string[];
  heldSeatIds: string[];
  soldSeatIds: string[];
  holds: Record<string, { userId: string; expiresAt: number }>;
}

export interface SeatCounts {
  held: number;
  sold: number;
  heldCount: number;
  soldCount: number;
}

export interface SeatHoldParams {
  eventId: string;
  seatId: string;
  userId: string;
  ttlSeconds?: number;
  maxPerUser?: number;
}

export interface SeatHoldResult {
  success: boolean;
  code: string;
  expiresAt?: number;
}

const registeredClients = new WeakSet<Redis>();

export function registerRedisScripts(redis: Redis): Redis {
  if (registeredClients.has(redis)) {
    return redis;
  }

  redis.defineCommand("hold_seats", {
    numberOfKeys: 3,
    lua: HOLD_SEATS_LUA,
  });

  redis.defineCommand("release_seats", {
    numberOfKeys: 2,
    lua: RELEASE_SEATS_LUA,
  });

  redis.defineCommand("confirm_sold", {
    numberOfKeys: 3,
    lua: CONFIRM_SOLD_LUA,
  });

  redis.defineCommand("unsell_seats", {
    numberOfKeys: 1,
    lua: UNSELL_SEATS_LUA,
  });

  redis.defineCommand("extend_hold", {
    numberOfKeys: 3,
    lua: EXTEND_HOLD_LUA,
  });

  redis.defineCommand("expire_due", {
    numberOfKeys: 1,
    lua: EXPIRE_DUE_LUA,
  });

  registeredClients.add(redis);
  return redis;
}

export class RedisScriptsWrapper {
  constructor(private readonly redis: Redis) {
    registerRedisScripts(this.redis);
  }

  async holdSeats(params: HoldSeatsParams): Promise<HoldSeatsResult>;
  async holdSeats(
    eventId: string,
    userId: string,
    seatIds: string[],
    ttlSeconds?: number,
    maxPerUser?: number,
    nowMs?: number,
  ): Promise<HoldSeatsResult>;
  async holdSeats(
    paramsOrEventId: HoldSeatsParams | string,
    userId?: string,
    seatIds?: string[],
    ttlSeconds = DEFAULT_HOLD_TTL_SECONDS,
    maxPerUser = DEFAULT_MAX_SEATS_PER_USER,
    nowMs?: number,
  ): Promise<HoldSeatsResult> {
    const resolved: HoldSeatsParams =
      typeof paramsOrEventId === "string"
        ? {
            eventId: paramsOrEventId,
            userId: userId ?? "",
            seatIds: seatIds ?? [],
            ttlSeconds,
            maxPerUser,
            nowMs,
          }
        : paramsOrEventId;

    const currentMs = resolved.nowMs ?? Date.now();
    const ttl = resolved.ttlSeconds ?? DEFAULT_HOLD_TTL_SECONDS;
    const maxSeats = resolved.maxPerUser ?? DEFAULT_MAX_SEATS_PER_USER;

    const raw = await this.redis.hold_seats(
      RedisKeys.seatSold(resolved.eventId),
      RedisKeys.holdExpiry(resolved.eventId),
      RedisKeys.userHolds(resolved.eventId, resolved.userId),
      resolved.eventId,
      resolved.userId,
      ttl,
      maxSeats,
      currentMs,
      ...resolved.seatIds,
    );

    const success = raw[0] === 1;
    const code = raw[1];

    if (success) {
      const expiresAt = Number(raw[2]);
      const lockedSeats = Array.isArray(raw[3]) ? raw[3] : resolved.seatIds;
      return {
        success: true,
        ok: true,
        code: "OK",
        expiresAt,
        seatIds: lockedSeats,
        conflictingSeats: [],
        conflicts: [],
      };
    }

    const conflicts = Array.isArray(raw[2]) ? raw[2] : [];
    return {
      success: false,
      ok: false,
      code,
      seatIds: [],
      conflictingSeats: conflicts,
      conflicts,
    };
  }

  hold_seats = this.holdSeats.bind(this);

  async holdSeat(params: SeatHoldParams): Promise<SeatHoldResult> {
    const res = await this.holdSeats({
      eventId: params.eventId,
      userId: params.userId,
      seatIds: [params.seatId],
      ttlSeconds: params.ttlSeconds,
      maxPerUser: params.maxPerUser,
    });
    return {
      success: res.success,
      code: res.code,
      expiresAt: res.expiresAt,
    };
  }

  async releaseSeats(params: ReleaseSeatsParams): Promise<ReleaseSeatsResult>;
  async releaseSeats(
    eventId: string,
    userId: string,
    seatIds: string[],
  ): Promise<ReleaseSeatsResult>;
  async releaseSeats(
    paramsOrEventId: ReleaseSeatsParams | string,
    userId?: string,
    seatIds?: string[],
  ): Promise<ReleaseSeatsResult> {
    const resolved: ReleaseSeatsParams =
      typeof paramsOrEventId === "string"
        ? {
            eventId: paramsOrEventId,
            userId: userId ?? "",
            seatIds: seatIds ?? [],
          }
        : paramsOrEventId;

    const raw = await this.redis.release_seats(
      RedisKeys.holdExpiry(resolved.eventId),
      RedisKeys.userHolds(resolved.eventId, resolved.userId),
      resolved.eventId,
      resolved.userId,
      ...resolved.seatIds,
    );

    const success = raw[0] === 1;
    const code = raw[1];
    const list = Array.isArray(raw[2]) ? raw[2] : [];

    return {
      success,
      ok: success,
      code,
      releasedSeats: success ? list : [],
      seatIds: success ? list : [],
      conflictingSeats: success ? [] : list,
    };
  }

  release_seats = this.releaseSeats.bind(this);

  async confirmSold(params: ConfirmSoldParams): Promise<ConfirmSoldResult>;
  async confirmSold(
    eventId: string,
    userId: string,
    seatIds: string[],
    nowMs?: number,
  ): Promise<ConfirmSoldResult>;
  async confirmSold(
    paramsOrEventId: ConfirmSoldParams | string,
    userId?: string,
    seatIds?: string[],
    nowMs?: number,
  ): Promise<ConfirmSoldResult> {
    const resolved: ConfirmSoldParams =
      typeof paramsOrEventId === "string"
        ? {
            eventId: paramsOrEventId,
            userId: userId ?? "",
            seatIds: seatIds ?? [],
            nowMs,
          }
        : paramsOrEventId;

    const currentMs = resolved.nowMs ?? Date.now();
    const raw = await this.redis.confirm_sold(
      RedisKeys.seatSold(resolved.eventId),
      RedisKeys.holdExpiry(resolved.eventId),
      RedisKeys.userHolds(resolved.eventId, resolved.userId),
      resolved.eventId,
      resolved.userId,
      currentMs,
      ...resolved.seatIds,
    );

    const success = raw[0] === 1;
    const code = raw[1];
    const list = Array.isArray(raw[2]) ? raw[2] : [];

    return {
      success,
      ok: success,
      code,
      soldSeats: success ? list : [],
      seatIds: success ? list : [],
      failedSeats: success ? [] : list,
    };
  }

  confirm_sold = this.confirmSold.bind(this);

  async unsellSeats(params: UnsellSeatsParams): Promise<UnsellSeatsResult>;
  async unsellSeats(
    eventId: string,
    seatIds: string[],
  ): Promise<UnsellSeatsResult>;
  async unsellSeats(
    paramsOrEventId: UnsellSeatsParams | string,
    seatIds?: string[],
  ): Promise<UnsellSeatsResult> {
    const resolved: UnsellSeatsParams =
      typeof paramsOrEventId === "string"
        ? {
            eventId: paramsOrEventId,
            seatIds: seatIds ?? [],
          }
        : paramsOrEventId;

    const raw = await this.redis.unsell_seats(
      RedisKeys.seatSold(resolved.eventId),
      resolved.eventId,
      ...resolved.seatIds,
    );

    const removed = Array.isArray(raw[2]) ? raw[2] : [];
    return {
      success: true,
      ok: true,
      code: "OK",
      unsoldSeats: removed,
      seatIds: removed,
    };
  }

  unsell_seats = this.unsellSeats.bind(this);

  async extendHold(params: ExtendHoldParams): Promise<ExtendHoldResult>;
  async extendHold(
    eventId: string,
    userId: string,
    seatIds?: string[],
    graceSeconds?: number,
    nowMs?: number,
  ): Promise<ExtendHoldResult>;
  async extendHold(
    paramsOrEventId: ExtendHoldParams | string,
    userId?: string,
    seatIds?: string[],
    graceSeconds = DEFAULT_EXTEND_GRACE_SECONDS,
    nowMs?: number,
  ): Promise<ExtendHoldResult> {
    const resolved: ExtendHoldParams =
      typeof paramsOrEventId === "string"
        ? {
            eventId: paramsOrEventId,
            userId: userId ?? "",
            seatIds,
            graceSeconds,
            nowMs,
          }
        : paramsOrEventId;

    const currentMs = resolved.nowMs ?? Date.now();
    const grace = resolved.graceSeconds ?? DEFAULT_EXTEND_GRACE_SECONDS;
    const targetSeats = resolved.seatIds ?? [];

    const raw = await this.redis.extend_hold(
      RedisKeys.holdExpiry(resolved.eventId),
      RedisKeys.userHolds(resolved.eventId, resolved.userId),
      RedisKeys.holdExtended(resolved.eventId, resolved.userId),
      resolved.eventId,
      resolved.userId,
      grace,
      currentMs,
      ...targetSeats,
    );

    const success = raw[0] === 1;
    const code = raw[1];

    if (success) {
      const expiresAt = Number(raw[2]);
      const extendedSeats = Array.isArray(raw[3]) ? raw[3] : targetSeats;
      return {
        success: true,
        ok: true,
        code: "OK",
        expiresAt,
        seatIds: extendedSeats,
        failedSeats: [],
      };
    }

    const failed = Array.isArray(raw[2]) ? raw[2] : [];
    return {
      success: false,
      ok: false,
      code,
      seatIds: [],
      failedSeats: failed,
    };
  }

  extend_hold = this.extendHold.bind(this);

  async expireDue(
    eventId: string,
    nowMs: number = Date.now(),
  ): Promise<string[]> {
    const freed = await this.redis.expire_due(
      RedisKeys.holdExpiry(eventId),
      eventId,
      nowMs,
    );
    return Array.isArray(freed) ? freed : [];
  }

  expire_due = this.expireDue.bind(this);

  async getSnapshot(
    eventId: string,
    nowMs: number = Date.now(),
  ): Promise<SeatSnapshot> {
    const [soldMembers, expiryEntries] = await Promise.all([
      this.redis.smembers(RedisKeys.seatSold(eventId)),
      this.redis.zrange(RedisKeys.holdExpiry(eventId), 0, -1, "WITHSCORES"),
    ]);

    const soldSet = new Set(soldMembers);
    const candidateSeats: Array<{ seatId: string; expiresAt: number }> = [];

    for (let i = 0; i < expiryEntries.length; i += 2) {
      const seatId = expiryEntries[i];
      const expiresAt = Number(expiryEntries[i + 1]);
      if (seatId && expiresAt > nowMs && !soldSet.has(seatId)) {
        candidateSeats.push({ seatId, expiresAt });
      }
    }

    const holds: Record<string, { userId: string; expiresAt: number }> = {};
    const held: string[] = [];

    if (candidateSeats.length > 0) {
      const lockKeys = candidateSeats.map((c) =>
        RedisKeys.seatLock(eventId, c.seatId),
      );
      const owners = await this.redis.mget(...lockKeys);

      for (let i = 0; i < candidateSeats.length; i++) {
        const owner = owners[i];
        const candidate = candidateSeats[i];
        if (owner && candidate) {
          held.push(candidate.seatId);
          holds[candidate.seatId] = {
            userId: owner,
            expiresAt: candidate.expiresAt,
          };
        }
      }
    }

    held.sort();
    const sold = [...soldSet].sort();

    return {
      eventId,
      held,
      sold,
      heldSeatIds: held,
      soldSeatIds: sold,
      holds,
    };
  }

  async getCounts(
    eventId: string,
    nowMs: number = Date.now(),
  ): Promise<SeatCounts> {
    const snapshot = await this.getSnapshot(eventId, nowMs);
    return {
      held: snapshot.held.length,
      sold: snapshot.sold.length,
      heldCount: snapshot.held.length,
      soldCount: snapshot.sold.length,
    };
  }
}

export { RedisScriptsWrapper as RedisSeatLockEngine };

export function createSeatLockClient(redis: Redis): RedisScriptsWrapper {
  return new RedisScriptsWrapper(redis);
}

export async function getSnapshot(
  redis: Redis,
  eventId: string,
  nowMs?: number,
): Promise<SeatSnapshot> {
  return new RedisScriptsWrapper(redis).getSnapshot(eventId, nowMs);
}

export async function getCounts(
  redis: Redis,
  eventId: string,
  nowMs?: number,
): Promise<SeatCounts> {
  return new RedisScriptsWrapper(redis).getCounts(eventId, nowMs);
}

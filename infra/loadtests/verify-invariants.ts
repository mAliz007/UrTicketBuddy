import { loadEnv } from "@urticketbuddy/config";
import {
  AppDataSource,
  EventSeat,
  Order,
  OrderItem,
  Ticket,
} from "@urticketbuddy/db";
import Redis from "ioredis";
import { LOADTEST_EVENT_ID } from "./seed-loadtest";

export interface InvariantSnapshotInput {
  eventId: string;
  soldEventSeats: Array<{ id: string; seatId: string; status: string }>;
  completedOrderItems: Array<{
    id: string;
    orderId: string;
    eventId: string;
    eventSeatId: string;
  }>;
  activeTickets: Array<{
    id: string;
    eventId: string;
    eventSeatId: string;
    status: string;
  }>;
  redisSoldSeatIds: string[];
  redisActiveLockSeatIds: string[];
  redisHoldExpirySeatIds: string[];
}

export interface InvariantCheckReport {
  eventId: string;
  passed: boolean;
  zeroDoubleBooking: {
    passed: boolean;
    duplicateOrderItemSeats: string[];
    duplicateTicketSeats: string[];
  };
  stateExclusivity: {
    passed: boolean;
    soldAndLockedOverlap: string[];
    soldAndHoldExpiryOverlap: string[];
  };
  redisPostgresParity: {
    passed: boolean;
    redisSoldCount: number;
    postgresSoldSeatsCount: number;
    completedOrderItemsCount: number;
  };
  violations: string[];
}

export function evaluateConcurrencyInvariants(
  snapshot: InvariantSnapshotInput,
): InvariantCheckReport {
  const violations: string[] = [];

  // 1. Zero Double-Booking Invariant
  const seenOrderSeats = new Set<string>();
  const duplicateOrderItemSeats = new Set<string>();
  for (const item of snapshot.completedOrderItems) {
    const key = `${item.eventId}:${item.eventSeatId}`;
    if (seenOrderSeats.has(key)) {
      duplicateOrderItemSeats.add(item.eventSeatId);
    }
    seenOrderSeats.add(key);
  }

  const seenTicketSeats = new Set<string>();
  const duplicateTicketSeats = new Set<string>();
  for (const ticket of snapshot.activeTickets) {
    if (ticket.status === "ISSUED" || ticket.status === "CHECKED_IN") {
      const key = `${ticket.eventId}:${ticket.eventSeatId}`;
      if (seenTicketSeats.has(key)) {
        duplicateTicketSeats.add(ticket.eventSeatId);
      }
      seenTicketSeats.add(key);
    }
  }

  const zeroDoubleBookingPassed =
    duplicateOrderItemSeats.size === 0 && duplicateTicketSeats.size === 0;
  if (!zeroDoubleBookingPassed) {
    violations.push(
      `Zero Double-Booking violated: duplicateOrderSeats=[${Array.from(duplicateOrderItemSeats).join(",")}], duplicateTicketSeats=[${Array.from(duplicateTicketSeats).join(",")}]`,
    );
  }

  // 2. State Exclusivity Invariant (no seat simultaneously in seat_sold and seat_lock / hold_expiry)
  const soldSet = new Set(snapshot.redisSoldSeatIds);
  const soldAndLockedOverlap = snapshot.redisActiveLockSeatIds.filter((s) =>
    soldSet.has(s),
  );
  const soldAndHoldExpiryOverlap = snapshot.redisHoldExpirySeatIds.filter((s) =>
    soldSet.has(s),
  );

  const stateExclusivityPassed =
    soldAndLockedOverlap.length === 0 && soldAndHoldExpiryOverlap.length === 0;
  if (!stateExclusivityPassed) {
    violations.push(
      `State Exclusivity violated: sold+locked=[${soldAndLockedOverlap.join(",")}], sold+holdExpiry=[${soldAndHoldExpiryOverlap.join(",")}]`,
    );
  }

  // 3. Redis-Postgres Parity Invariant
  const redisSoldCount = soldSet.size;
  const postgresSoldSeatsCount = snapshot.soldEventSeats.filter(
    (s) => s.status === "SOLD",
  ).length;
  const completedOrderItemsCount = snapshot.completedOrderItems.length;

  const redisPostgresParityPassed =
    redisSoldCount === postgresSoldSeatsCount &&
    redisSoldCount === completedOrderItemsCount;
  if (!redisPostgresParityPassed) {
    violations.push(
      `Redis-Postgres Parity violated: redisSoldCount=${redisSoldCount}, postgresSoldSeatsCount=${postgresSoldSeatsCount}, completedOrderItemsCount=${completedOrderItemsCount}`,
    );
  }

  return {
    eventId: snapshot.eventId,
    passed:
      zeroDoubleBookingPassed &&
      stateExclusivityPassed &&
      redisPostgresParityPassed,
    zeroDoubleBooking: {
      passed: zeroDoubleBookingPassed,
      duplicateOrderItemSeats: Array.from(duplicateOrderItemSeats),
      duplicateTicketSeats: Array.from(duplicateTicketSeats),
    },
    stateExclusivity: {
      passed: stateExclusivityPassed,
      soldAndLockedOverlap,
      soldAndHoldExpiryOverlap,
    },
    redisPostgresParity: {
      passed: redisPostgresParityPassed,
      redisSoldCount,
      postgresSoldSeatsCount,
      completedOrderItemsCount,
    },
    violations,
  };
}

export async function verifyLiveEventInvariants(
  eventId: string = process.env.EVENT_ID || LOADTEST_EVENT_ID,
): Promise<InvariantCheckReport> {
  const env = loadEnv();
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 2,
  });

  try {
    const seatRepo = AppDataSource.getRepository(EventSeat);
    const orderRepo = AppDataSource.getRepository(Order);
    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const ticketRepo = AppDataSource.getRepository(Ticket);

    const soldEventSeats = await seatRepo.find({
      where: { eventId, status: "SOLD" },
    });

    const completedOrders = await orderRepo.find({
      where: { eventId, status: "COMPLETED" },
    });
    const completedOrderIds = new Set(completedOrders.map((o) => o.id));
    const allOrderItems =
      completedOrderIds.size > 0 ? await orderItemRepo.find() : [];
    const completedOrderItems = allOrderItems
      .filter((item) => completedOrderIds.has(item.orderId))
      .map((item) => ({
        id: item.id,
        orderId: item.orderId,
        eventId,
        eventSeatId: item.eventSeatId,
      }));

    const activeTickets = (await ticketRepo.find({ where: { eventId } })).map(
      (t) => ({
        id: t.id,
        eventId: t.eventId,
        eventSeatId: t.eventSeatId,
        status: t.status,
      }),
    );

    const redisSoldSeatIds = await redis.smembers(`seat_sold:{${eventId}}`);
    const redisHoldExpirySeatIds = await redis.zrange(
      `hold_expiry:{${eventId}}`,
      0,
      -1,
    );

    const lockPrefix = `seat_lock:{${eventId}}:`;
    const redisActiveLockSeatIds: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${lockPrefix}*`,
        "COUNT",
        500,
      );
      cursor = nextCursor;
      for (const key of keys) {
        redisActiveLockSeatIds.push(key.slice(lockPrefix.length));
      }
    } while (cursor !== "0");

    return evaluateConcurrencyInvariants({
      eventId,
      soldEventSeats: soldEventSeats.map((s) => ({
        id: s.id,
        seatId: s.seatId,
        status: s.status,
      })),
      completedOrderItems,
      activeTickets,
      redisSoldSeatIds,
      redisActiveLockSeatIds,
      redisHoldExpirySeatIds,
    });
  } finally {
    await redis.quit().catch(() => undefined);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => undefined);
    }
  }
}

if (require.main === module) {
  verifyLiveEventInvariants()
    .then((report) => {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      if (!report.passed) {
        process.stderr.write(
          `INVARIANT VERIFICATION FAILED:\n${report.violations.join("\n")}\n`,
        );
        process.exit(1);
      }
      process.stdout.write(
        "✓ All post-run DB & Redis concurrency invariants passed!\n",
      );
    })
    .catch((err) => {
      process.stderr.write(
        `Verifier error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    });
}

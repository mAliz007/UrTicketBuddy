import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { loadEnv } from "@urticketbuddy/config";
import { UserRole } from "@urticketbuddy/contracts";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../src/database/database.tokens";
import { Order, OrderItem, EventSeat } from "@urticketbuddy/db";

jest.setTimeout(30000);

describe("Orders & Checkout API (e2e - Supertest)", () => {
  let app: INestApplication;
  let customerToken: string;

  const eventId = "e0000000-0000-0000-0000-000000000001";
  const userId = "usr-vip-999";
  const otherUserId = "usr-intruder-000";

  const seat1 = {
    id: "s0000000-0000-0000-0000-000000000001",
    eventId,
    seatId: "SEC-VIP-1",
    status: "AVAILABLE",
    x: 10,
    y: 10,
  };

  const seat2 = {
    id: "s0000000-0000-0000-0000-000000000002",
    eventId,
    seatId: "SEC-VIP-2",
    status: "AVAILABLE",
    x: 20,
    y: 10,
  };

  // In-memory test stores
  const ordersStore = new Map<string, any>();
  const orderItemsStore = new Map<string, any>();
  const eventSeatsStore = new Map<string, any>();
  const redisHolds = new Map<string, { userId: string; expiresAt: number }>();
  const redisSold = new Set<string>();
  const publishedEvents: Array<{ channel: string; message: string }> = [];

  const mockTransactionManager = {
    create: jest.fn((entityClass: any, data: any) => {
      const id = `${entityClass.name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      return {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
    }),
    save: jest.fn(async (entityClass: any, entityOrEntities: any) => {
      if (Array.isArray(entityOrEntities)) {
        for (const item of entityOrEntities) {
          if (item && "price" in item && "eventSeatId" in item) {
            orderItemsStore.set(item.id, item);
          }
        }
        return entityOrEntities;
      }
      ordersStore.set(entityOrEntities.id, entityOrEntities);
      return entityOrEntities;
    }),
    update: jest.fn(async (entityClass: any, criteria: any, partial: any) => {
      for (const seat of eventSeatsStore.values()) {
        if (criteria?.id?._value?.includes(seat.id)) {
          seat.status = partial.status;
        }
      }
      return { affected: criteria?.id?._value?.length || 1 };
    }),
    find: jest.fn(async (entityClass: any, options: any) => {
      const ids = options?.where?.id?._value || [];
      return Array.from(eventSeatsStore.values()).filter((s) =>
        ids.includes(s.id),
      );
    }),
  };

  const mockDataSource = {
    isInitialized: true,
    destroy: jest.fn(),
    getRepository: jest.fn(() => ({
      create: jest.fn((dto: any) => dto),
      save: jest.fn(async (entity: any) => entity),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    })),
    transaction: jest.fn(async (cb: (mgr: any) => Promise<any>) => {
      return cb(mockTransactionManager);
    }),
  };

  const mockOrderRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const order = ordersStore.get(where.id);
      if (!order) return null;
      const items = Array.from(orderItemsStore.values()).filter(
        (i) => i.orderId === order.id,
      );
      return {
        ...order,
        items,
        event: { id: order.eventId, name: "Concert in the Park" },
      };
    }),
  };

  const mockOrderItemRepo = {
    find: jest.fn(async ({ where }: any) => {
      return Array.from(orderItemsStore.values()).filter(
        (i) => i.orderId === where.orderId,
      );
    }),
  };

  const mockEventSeatRepo = {
    find: jest.fn(async ({ where }: any) => {
      const requestedIds = where.seatId?._value || [];
      return Array.from(eventSeatsStore.values()).filter(
        (s) => s.eventId === where.eventId && requestedIds.includes(s.seatId),
      );
    }),
  };

  const mockRedisClient = {
    get: jest.fn(async (key: string) => {
      const match = key.match(/:([^:]+)$/);
      const seatId = match ? match[1] : "";
      const hold = redisHolds.get(seatId);
      return hold ? hold.userId : null;
    }),
    publish: jest.fn(async (channel: string, message: string) => {
      publishedEvents.push({ channel, message });
      return 1;
    }),
  };

  const mockRedisScripts = {
    getSnapshot: jest.fn(async () => {
      const holds: Record<string, { userId: string; expiresAt: number }> = {};
      for (const [seatId, hold] of redisHolds.entries()) {
        holds[seatId] = hold;
      }
      return {
        eventId,
        held: Array.from(redisHolds.keys()),
        sold: Array.from(redisSold),
        heldSeatIds: Array.from(redisHolds.keys()),
        soldSeatIds: Array.from(redisSold),
        holds,
      };
    }),
    confirmSold: jest.fn(
      async (eId: string, uId: string, seatIds: string[]) => {
        for (const sId of seatIds) {
          const hold = redisHolds.get(sId);
          if (!hold || hold.userId !== uId || hold.expiresAt <= Date.now()) {
            return { success: false, code: "HOLD_EXPIRED", soldSeats: [] };
          }
        }
        for (const sId of seatIds) {
          redisHolds.delete(sId);
          redisSold.add(sId);
        }
        return { success: true, code: "OK", soldSeats: seatIds };
      },
    ),
    unsellSeats: jest.fn(async (eId: string, seatIds: string[]) => {
      for (const sId of seatIds) {
        redisSold.delete(sId);
      }
      return { success: true, count: seatIds.length };
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue(mockDataSource)
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(ORDER_REPOSITORY)
      .useValue(mockOrderRepo)
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue(mockOrderItemRepo)
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue(mockEventSeatRepo)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue(mockRedisScripts)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    const env = loadEnv();
    const jwtService = new JwtService({ secret: env.JWT_SECRET });
    customerToken = jwtService.sign({
      sub: userId,
      id: userId,
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    ordersStore.clear();
    orderItemsStore.clear();
    eventSeatsStore.clear();
    redisHolds.clear();
    redisSold.clear();
    publishedEvents.length = 0;

    // Seed test seats
    eventSeatsStore.set(seat1.id, { ...seat1 });
    eventSeatsStore.set(seat2.id, { ...seat2 });
  });

  it("POST /api/v1/orders/checkout - should successfully complete checkout, insert order items, update seat to SOLD, and publish pub/sub", async () => {
    // 1. Establish active holds in Redis for the user
    redisHolds.set(seat1.seatId, {
      userId,
      expiresAt: Date.now() + 600000,
    });
    redisHolds.set(seat2.seatId, {
      userId,
      expiresAt: Date.now() + 600000,
    });

    const payload = {
      eventId,
      seatIds: [seat1.seatId, seat2.seatId],
      paymentMethodToken: "tok_visa_success",
      userId,
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .send(payload)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBe(userId);
    expect(res.body.eventId).toBe(eventId);
    expect(res.body.status).toBe("COMPLETED");
    expect(res.body.totalAmount).toBe(2000); // 2 seats * 1000
    expect(res.body.currency).toBe("PKR");
    expect(res.body.paymentGatewayRef).toBeDefined();
    expect(res.body.items).toHaveLength(2);

    // Verify order was saved in database
    expect(ordersStore.has(res.body.id)).toBe(true);
    expect(orderItemsStore.size).toBe(2);

    // Verify PostgreSQL seats updated to SOLD
    expect(eventSeatsStore.get(seat1.id).status).toBe("SOLD");
    expect(eventSeatsStore.get(seat2.id).status).toBe("SOLD");

    // Verify Redis lock confirmed sold
    expect(redisSold.has(seat1.seatId)).toBe(true);
    expect(redisSold.has(seat2.seatId)).toBe(true);

    // Verify Pub/Sub was published
    expect(publishedEvents.length).toBeGreaterThanOrEqual(2);
    const eventTopics = publishedEvents.map((e) => e.channel);
    expect(eventTopics).toContain(`seat-updates:${eventId}`);
    expect(eventTopics).toContain("seat.state");
  });

  it("POST /api/v1/orders/checkout - should return 409 Conflict (HOLD_EXPIRED) if seat hold is expired or not held", async () => {
    // Empty holds in Redis
    const payload = {
      eventId,
      seatIds: [seat1.seatId],
      paymentMethodToken: "tok_visa",
      userId,
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .send(payload)
      .expect(409);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("HOLD_EXPIRED");
    // Verify no order was created
    expect(ordersStore.size).toBe(0);
  });

  it("POST /api/v1/orders/checkout - should return 409 Conflict (SEAT_NOT_HELD_BY_YOU) if seat is held by someone else", async () => {
    // Hold owned by someone else
    redisHolds.set(seat1.seatId, {
      userId: otherUserId,
      expiresAt: Date.now() + 600000,
    });

    const payload = {
      eventId,
      seatIds: [seat1.seatId],
      paymentMethodToken: "tok_visa",
      userId,
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .send(payload)
      .expect(409);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("SEAT_NOT_HELD_BY_YOU");
    expect(ordersStore.size).toBe(0);
  });

  it("POST /api/v1/orders/checkout - should return 400 Bad Request (PAYMENT_FAILED) and rollback on payment failure", async () => {
    // Establish active hold
    redisHolds.set(seat1.seatId, {
      userId,
      expiresAt: Date.now() + 600000,
    });

    const payload = {
      eventId,
      seatIds: [seat1.seatId],
      paymentMethodToken: "tok_fail", // Triggers simulated payment gateway failure
      userId,
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .send(payload)
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("PAYMENT_FAILED");

    // Verify ACID rollback: no order created, seat not marked sold
    expect(ordersStore.size).toBe(0);
    expect(orderItemsStore.size).toBe(0);
    expect(eventSeatsStore.get(seat1.id).status).toBe("AVAILABLE");
    expect(redisSold.has(seat1.seatId)).toBe(false);
  });

  it("GET /api/v1/orders/:id - should return order details with line items", async () => {
    // Create an order first
    const orderId = "order-test-retrieve-1";
    ordersStore.set(orderId, {
      id: orderId,
      userId,
      eventId,
      totalAmount: 1000,
      currency: "PKR",
      status: "COMPLETED",
      paymentGatewayRef: "txn_test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    orderItemsStore.set("item-1", {
      id: "item-1",
      orderId,
      eventSeatId: seat1.id,
      price: 1000,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.id).toBe(orderId);
    expect(res.body.userId).toBe(userId);
    expect(res.body.items).toHaveLength(1);
  });

  it("GET /api/v1/orders/:id - should return 404 Not Found for non-existent order", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/orders/non-existent-order-id")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

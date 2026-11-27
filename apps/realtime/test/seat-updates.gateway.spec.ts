import { EventEmitter } from "events";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { loadEnv } from "@urticketbuddy/config";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import { io, Socket } from "socket.io-client";
import { GatewayModule } from "../src/gateway/gateway.module";
import { REALTIME_REDIS_SUBSCRIBER } from "../src/gateway/gateway.tokens";
import { signSocketJwt } from "../src/gateway/seat-updates.gateway";

jest.setTimeout(30000);

class SharedPubSubBus {
  private readonly subscribers = new Set<MockRedisSubscriber>();

  register(sub: MockRedisSubscriber): void {
    this.subscribers.add(sub);
  }

  publish(channel: string, message: string): void {
    for (const sub of this.subscribers) {
      sub.emit("message", channel, message);
    }
  }
}

class MockRedisSubscriber extends EventEmitter {
  constructor(private readonly bus?: SharedPubSubBus) {
    super();
    this.bus?.register(this);
  }

  subscribe = jest.fn().mockResolvedValue(1);
  psubscribe = jest.fn().mockResolvedValue(1);
  publish = jest.fn(async (channel: string, message: string) => {
    this.bus?.publish(channel, message);
    return 1;
  });
  quit = jest.fn().mockResolvedValue("OK");
  disconnect = jest.fn();
}

describe("SeatUpdatesGateway (WebSocket + JWT Auth + Multi-Replica Redis Pub/Sub)", () => {
  let app1: INestApplication;
  let app2: INestApplication;
  let port1: number;
  let port2: number;
  let sharedBus: SharedPubSubBus;
  let mockSubscriber1: MockRedisSubscriber;
  let mockSubscriber2: MockRedisSubscriber;
  let validToken: string;

  beforeAll(async () => {
    const env = loadEnv();
    validToken = signSocketJwt(
      {
        sub: "22222222-2222-4222-8222-222222222222",
        role: "CUSTOMER",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      env.JWT_SECRET,
    );

    sharedBus = new SharedPubSubBus();
    mockSubscriber1 = new MockRedisSubscriber(sharedBus);
    mockSubscriber2 = new MockRedisSubscriber(sharedBus);

    const mod1: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    })
      .overrideProvider(REALTIME_REDIS_SUBSCRIBER)
      .useValue(mockSubscriber1)
      .compile();

    const mod2: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    })
      .overrideProvider(REALTIME_REDIS_SUBSCRIBER)
      .useValue(mockSubscriber2)
      .compile();

    app1 = mod1.createNestApplication();
    await app1.listen(0, "127.0.0.1");
    const addr1 = app1.getHttpServer().address();
    port1 = typeof addr1 === "object" && addr1 !== null ? addr1.port : 3001;

    app2 = mod2.createNestApplication();
    await app2.listen(0, "127.0.0.1");
    const addr2 = app2.getHttpServer().address();
    port2 = typeof addr2 === "object" && addr2 !== null ? addr2.port : 3011;
  });

  afterAll(async () => {
    if (app1) await app1.close();
    if (app2) await app2.close();
  });

  it("rejects unauthenticated socket connections without a valid JWT token", async () => {
    const unauthClient: Socket = io(`http://127.0.0.1:${port1}`, {
      transports: ["websocket"],
      forceNew: true,
    });

    try {
      const err = await new Promise<Error>((resolve) => {
        unauthClient.once("connect_error", (e) => resolve(e));
      });
      expect(err.message).toContain("UNAUTHORIZED");
    } finally {
      unauthClient.disconnect();
    }
  });

  it("broadcasts seat:state with expiresAt to all clients in the event room when Pub/Sub fires on seat.state", async () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const userId = "22222222-2222-4222-8222-222222222222";
    const seatIds = ["sec1-A-1", "sec1-A-2"];
    const expiresAt = Date.now() + 600_000;

    const client1: Socket = io(`http://127.0.0.1:${port1}`, {
      transports: ["websocket"],
      forceNew: true,
      auth: { token: validToken },
    });
    const client2: Socket = io(`http://127.0.0.1:${port1}`, {
      transports: ["websocket"],
      forceNew: true,
      auth: { token: validToken },
    });

    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          client1.once("connect", () => resolve());
          client1.once("connect_error", reject);
        }),
        new Promise<void>((resolve, reject) => {
          client2.once("connect", () => resolve());
          client2.once("connect_error", reject);
        }),
      ]);

      await Promise.all([
        new Promise<void>((resolve) => {
          client1.once("room:joined", () => resolve());
          client1.emit("room:join", { eventId });
        }),
        new Promise<void>((resolve) => {
          client2.once("room:joined", () => resolve());
          client2.emit("room:join", { eventId });
        }),
      ]);

      const mockRedisClient = {
        defineCommand: jest.fn(),
        hold_seats: jest
          .fn()
          .mockResolvedValue([1, "OK", String(expiresAt), seatIds]),
      } as unknown as Redis;

      const wrapper = new RedisScriptsWrapper(mockRedisClient);
      const holdResult = await wrapper.holdSeats({
        eventId,
        userId,
        seatIds,
      });
      expect(holdResult.success).toBe(true);

      const expectedPayload = {
        eventId,
        seatIds: holdResult.seatIds,
        state: "HELD",
        userId,
        expiresAt: holdResult.expiresAt,
      };

      const received1 = new Promise<unknown>((resolve) => {
        client1.once("seat:state", (payload) => resolve(payload));
      });
      const received2 = new Promise<unknown>((resolve) => {
        client2.once("seat:state", (payload) => resolve(payload));
      });

      mockSubscriber1.emit(
        "message",
        "seat.state",
        JSON.stringify(expectedPayload),
      );

      const [payload1, payload2] = await Promise.all([received1, received2]);
      expect(payload1).toEqual(expectedPayload);
      expect(payload2).toEqual(expectedPayload);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  it("Multi-replica test (F-5): a hold published via replica 2 reaches a socket connected to replica 1", async () => {
    const eventId = "99999999-9999-4999-8999-999999999999";
    const userId = "22222222-2222-4222-8222-222222222222";
    const seatIds = ["VIP-A-1"];
    const expiresAt = Date.now() + 600_000;

    // Client connects to Replica 1
    const clientOnReplica1: Socket = io(`http://127.0.0.1:${port1}`, {
      transports: ["websocket"],
      forceNew: true,
      auth: { token: validToken },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        clientOnReplica1.once("connect", () => resolve());
        clientOnReplica1.once("connect_error", reject);
      });

      await new Promise<void>((resolve) => {
        clientOnReplica1.once("room:joined", () => resolve());
        clientOnReplica1.emit("room:join", { eventId });
      });

      const receivedOnReplica1 = new Promise<unknown>((resolve) => {
        clientOnReplica1.once("seat:state", (payload) => resolve(payload));
      });

      const holdPayload = {
        eventId,
        seatIds,
        state: "HELD",
        userId,
        expiresAt,
      };

      // Hold event is published on Replica 2 via shared Redis Pub/Sub channel seat.state
      await mockSubscriber2.publish("seat.state", JSON.stringify(holdPayload));

      const delivered = await receivedOnReplica1;
      expect(delivered).toEqual(holdPayload);
    } finally {
      clientOnReplica1.disconnect();
    }
  });
});

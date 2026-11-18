import { EventEmitter } from "events";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import { io, Socket } from "socket.io-client";
import { GatewayModule } from "../src/gateway/gateway.module";
import { REALTIME_REDIS_SUBSCRIBER } from "../src/gateway/gateway.tokens";

jest.setTimeout(30000);

class MockRedisSubscriber extends EventEmitter {
  psubscribe = jest.fn().mockResolvedValue(1);
  quit = jest.fn().mockResolvedValue("OK");
  disconnect = jest.fn();
}

describe("SeatUpdatesGateway (WebSocket + Redis Pub/Sub)", () => {
  let app: INestApplication;
  let port: number;
  let mockSubscriber: MockRedisSubscriber;

  beforeAll(async () => {
    mockSubscriber = new MockRedisSubscriber();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    })
      .overrideProvider(REALTIME_REDIS_SUBSCRIBER)
      .useValue(mockSubscriber)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    port =
      typeof address === "object" && address !== null ? address.port : 3001;
  });

  afterAll(async () => {
    await app.close();
  });

  it("broadcasts seats-updated to all clients in the event room when Pub/Sub fires after holdSeats", async () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const userId = "22222222-2222-4222-8222-222222222222";
    const seatIds = ["sec1-A-1", "sec1-A-2"];
    const expiresAt = Date.now() + 600_000;

    const client1: Socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
    const client2: Socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
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
          client1.once("event-joined", () => resolve());
          client1.emit("join-event", { eventId });
        }),
        new Promise<void>((resolve) => {
          client2.once("event-joined", () => resolve());
          client2.emit("join-event", { eventId });
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
      };

      const received1 = new Promise<unknown>((resolve) => {
        client1.once("seats-updated", (payload) => resolve(payload));
      });
      const received2 = new Promise<unknown>((resolve) => {
        client2.once("seats-updated", (payload) => resolve(payload));
      });

      mockSubscriber.emit(
        "pmessage",
        "seat-updates:*",
        `seat-updates:${eventId}`,
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
});

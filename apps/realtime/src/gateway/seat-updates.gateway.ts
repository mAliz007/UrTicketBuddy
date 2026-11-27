import * as crypto from "crypto";
import { Inject, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import { loadEnv } from "@urticketbuddy/config";
import Redis from "ioredis";
import { Server, Socket } from "socket.io";
import { REALTIME_REDIS_SUBSCRIBER } from "./gateway.tokens";

export interface JoinEventPayload {
  eventId: string;
}

export interface SeatUpdatesBroadcastPayload {
  eventId: string;
  seatId?: string;
  seatIds?: string[];
  state: "HELD" | "SOLD" | "RELEASED" | "AVAILABLE";
  userId?: string;
  expiresAt?: number;
}

export function verifySocketJwt(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts as [
      string,
      string,
      string,
    ];
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function signSocketJwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureB64 = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class SeatUpdatesGateway
  implements OnGatewayInit, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SeatUpdatesGateway.name);
  private adapterPubClient?: Redis;
  private adapterSubClient?: Redis;

  constructor(
    @Inject(REALTIME_REDIS_SUBSCRIBER)
    private readonly subscriber: Redis,
  ) {}

  afterInit(server: Server): void {
    const env = loadEnv();

    // Configure @socket.io/redis-adapter when subscriber is a live ioredis client
    if (
      this.subscriber &&
      typeof (this.subscriber as unknown as { duplicate?: () => Redis })
        .duplicate === "function"
    ) {
      try {
        this.adapterPubClient = this.subscriber.duplicate();
        this.adapterSubClient = this.subscriber.duplicate();
        this.adapterPubClient.on("error", () => undefined);
        this.adapterSubClient.on("error", () => undefined);
        server.adapter(
          createAdapter(this.adapterPubClient, this.adapterSubClient),
        );
        this.logger.log("Configured @socket.io/redis-adapter on Socket.IO");
      } catch (err) {
        this.logger.warn(
          `Could not attach @socket.io/redis-adapter: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // JWT Socket Authentication Middleware
    server.use((socket: Socket, next: (err?: Error) => void) => {
      const authToken =
        (typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined) ||
        (typeof socket.handshake.headers?.authorization === "string"
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
          : undefined) ||
        (typeof socket.handshake.query?.token === "string"
          ? socket.handshake.query.token
          : undefined);

      if (!authToken) {
        return next(new Error("UNAUTHORIZED: Missing JWT token"));
      }

      const decoded = verifySocketJwt(authToken, env.JWT_SECRET);
      if (!decoded) {
        return next(new Error("UNAUTHORIZED: Invalid or expired JWT token"));
      }

      socket.data.user = decoded;
      return next();
    });
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on("message", (channel: string, message: string) => {
      this.handlePubSubMessage(channel, message);
    });

    this.subscriber.on(
      "pmessage",
      (_pattern: string, channel: string, message: string) => {
        this.handlePubSubMessage(channel, message);
      },
    );

    try {
      if (typeof this.subscriber.subscribe === "function") {
        await this.subscriber.subscribe("seat.state");
        this.logger.log("Subscribed to Redis Pub/Sub channel seat.state");
      }
      if (typeof this.subscriber.psubscribe === "function") {
        await this.subscriber.psubscribe("seat-updates:*");
        this.logger.log("Subscribed to Redis Pub/Sub pattern seat-updates:*");
      }
    } catch (err) {
      this.logger.warn(
        `Failed to subscribe to Redis Pub/Sub: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const client of [
      this.subscriber,
      this.adapterPubClient,
      this.adapterSubClient,
    ]) {
      if (client && typeof client.quit === "function") {
        try {
          await client.quit();
        } catch {
          client.disconnect?.();
        }
      }
    }
  }

  @SubscribeMessage("room:join")
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinEventPayload | string,
  ) {
    const eventId = typeof data === "string" ? data : data?.eventId;
    if (!eventId || typeof eventId !== "string") {
      return { event: "error", data: { message: "Invalid eventId" } };
    }

    const room = `event:${eventId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: "room:joined", data: { room, eventId } };
  }

  @SubscribeMessage("room:leave")
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinEventPayload | string,
  ) {
    const eventId = typeof data === "string" ? data : data?.eventId;
    if (!eventId || typeof eventId !== "string") {
      return { event: "error", data: { message: "Invalid eventId" } };
    }

    const room = `event:${eventId}`;
    await client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: "room:left", data: { room, eventId } };
  }

  @SubscribeMessage("join-event")
  async handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinEventPayload | string,
  ) {
    const eventId = typeof data === "string" ? data : data?.eventId;
    if (!eventId || typeof eventId !== "string") {
      return { event: "error", data: { message: "Invalid eventId" } };
    }

    const room = `event:${eventId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: "event-joined", data: { room, eventId } };
  }

  handlePubSubMessage(channel: string, rawMessage: string): void {
    let payload: SeatUpdatesBroadcastPayload;
    try {
      payload = JSON.parse(rawMessage) as SeatUpdatesBroadcastPayload;
    } catch (err) {
      this.logger.warn(
        `Ignoring malformed Pub/Sub message on ${channel}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    const eventId =
      payload.eventId ||
      (channel.startsWith("seat-updates:")
        ? channel.replace(/^seat-updates:/, "")
        : "");
    if (!eventId || !this.server) {
      return;
    }

    const room = `event:${eventId}`;
    this.server.to(room).emit("seat:state", payload);
    this.server.to(room).emit("seats-updated", payload);
    this.logger.log(`Broadcasted seat:state to room ${room}`);
  }
}

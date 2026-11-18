import { Inject, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import Redis from "ioredis";
import { Server, Socket } from "socket.io";
import { REALTIME_REDIS_SUBSCRIBER } from "./gateway.tokens";

export interface JoinEventPayload {
  eventId: string;
}

export interface SeatUpdatesBroadcastPayload {
  eventId: string;
  seatIds: string[];
  state: "HELD" | "SOLD" | "RELEASED";
  userId?: string;
  expiresAt?: number;
}

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class SeatUpdatesGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SeatUpdatesGateway.name);

  constructor(
    @Inject(REALTIME_REDIS_SUBSCRIBER)
    private readonly subscriber: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber.on(
      "pmessage",
      (_pattern: string, channel: string, message: string) => {
        this.handlePubSubMessage(channel, message);
      },
    );

    try {
      await this.subscriber.psubscribe("seat-updates:*");
      this.logger.log("Subscribed to Redis Pub/Sub pattern seat-updates:*");
    } catch (err) {
      this.logger.warn(
        `Failed to psubscribe to seat-updates:*: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber && typeof this.subscriber.quit === "function") {
      try {
        await this.subscriber.quit();
      } catch {
        this.subscriber.disconnect?.();
      }
    }
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

    const eventId = payload.eventId || channel.replace(/^seat-updates:/, "");
    if (!eventId || !this.server) {
      return;
    }

    const room = `event:${eventId}`;
    this.server.to(room).emit("seats-updated", payload);
    this.logger.log(`Broadcasted seats-updated to room ${room}`);
  }
}

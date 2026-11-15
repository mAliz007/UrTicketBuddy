import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { RoomJoinPayload, RoomLeavePayload } from "@urticketbuddy/contracts";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  @SubscribeMessage("room:join")
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomJoinPayload,
  ) {
    const room = `event:${data.eventId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: "room:joined", data: { room } };
  }

  @SubscribeMessage("room:leave")
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomLeavePayload,
  ) {
    const room = `event:${data.eventId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: "room:left", data: { room } };
  }
}

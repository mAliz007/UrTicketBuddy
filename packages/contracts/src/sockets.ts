import { z } from "zod";
import { SeatState } from "./enums";

export const SeatStateEventSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string(),
  state: z.nativeEnum(SeatState),
  userId: z.string().uuid().optional(),
  expiresAt: z.number().int().optional(),
});

export type SeatStateEvent = z.infer<typeof SeatStateEventSchema>;

export const RoomJoinSchema = z.object({
  eventId: z.string().uuid(),
});

export type RoomJoinPayload = z.infer<typeof RoomJoinSchema>;

export const RoomLeaveSchema = z.object({
  eventId: z.string().uuid(),
});

export type RoomLeavePayload = z.infer<typeof RoomLeaveSchema>;

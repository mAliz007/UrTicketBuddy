import { z } from "zod";
import { SeatState } from "./enums";

export const SeatStateEventSchema = z
  .object({
    eventId: z.guid(),
    seatId: z.string().min(1),
    state: z.nativeEnum(SeatState),
    userId: z.guid().optional(),
    expiresAt: z.number().int().optional(),
  })
  .strict();

export type SeatStateEvent = z.infer<typeof SeatStateEventSchema>;

export const RoomJoinSchema = z
  .object({
    eventId: z.guid(),
  })
  .strict();

export type RoomJoinPayload = z.infer<typeof RoomJoinSchema>;

export const RoomLeaveSchema = z
  .object({
    eventId: z.guid(),
  })
  .strict();

export type RoomLeavePayload = z.infer<typeof RoomLeaveSchema>;

import { z } from "zod";

export const HoldExpiryJobSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string(),
  userId: z.string().uuid(),
});

export type HoldExpiryJob = z.infer<typeof HoldExpiryJobSchema>;

export const SearchIndexJobSchema = z.object({
  entity: z.enum(["event", "venue"]),
  id: z.string().uuid(),
  action: z.enum(["index", "delete"]),
});

export type SearchIndexJob = z.infer<typeof SearchIndexJobSchema>;

export const OrderNotificationJobSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(["CONFIRMATION", "CANCELLATION"]),
});

export type OrderNotificationJob = z.infer<typeof OrderNotificationJobSchema>;

export const TicketSeedRotationJobSchema = z.object({
  ticketId: z.string().uuid(),
  currentSeedVersion: z.number().int(),
});

export type TicketSeedRotationJob = z.infer<typeof TicketSeedRotationJobSchema>;

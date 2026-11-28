import { z } from "zod";

export const HoldExpiryJobSchema = z.object({
  eventId: z.guid(),
  seatId: z.string(),
  userId: z.guid(),
});

export type HoldExpiryJob = z.infer<typeof HoldExpiryJobSchema>;

export const SearchIndexJobSchema = z.object({
  entity: z.enum(["event", "venue"]),
  id: z.guid(),
  action: z.enum(["index", "delete"]),
});

export type SearchIndexJob = z.infer<typeof SearchIndexJobSchema>;

export const OrderNotificationJobSchema = z.object({
  orderId: z.guid(),
  userId: z.guid(),
  type: z.enum(["CONFIRMATION", "CANCELLATION"]),
});

export type OrderNotificationJob = z.infer<typeof OrderNotificationJobSchema>;

export const TicketSeedRotationJobSchema = z.object({
  ticketId: z.guid(),
  currentSeedVersion: z.number().int(),
});

export type TicketSeedRotationJob = z.infer<typeof TicketSeedRotationJobSchema>;

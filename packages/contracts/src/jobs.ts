import { z } from "zod";

export const HoldExpiryJobSchema = z.object({
  eventId: z.string().uuid(),
  seatId: z.string(),
  userId: z.string().uuid(),
});

export type HoldExpiryJob = z.infer<typeof HoldExpiryJobSchema>;

export const SEARCH_INDEX_QUEUE = "search-index" as const;

export const SearchIndexJobActionSchema = z.enum(["index", "update", "delete"]);
export type SearchIndexJobAction = z.infer<typeof SearchIndexJobActionSchema>;

export const EventSearchGeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type EventSearchGeoPoint = z.infer<typeof EventSearchGeoPointSchema>;

export const SearchIndexJobSchema = z
  .object({
    entity: z.enum(["event", "venue"]).default("event"),
    id: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    action: SearchIndexJobActionSchema,
    title: z.string().optional(),
    description: z.string().optional(),
    city: z.string().optional(),
    category: z.string().optional(),
    startsAt: z.union([z.string(), z.date()]).optional(),
    status: z.string().optional(),
    venueId: z.string().uuid().optional(),
    venueName: z.string().optional(),
    location: EventSearchGeoPointSchema.nullable().optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
  })
  .refine((val) => Boolean(val.eventId || val.id), {
    message: "Either eventId or id must be provided",
  });

export type SearchIndexJob = z.infer<typeof SearchIndexJobSchema>;
export type SearchIndexJobInput = z.input<typeof SearchIndexJobSchema>;

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

import { z } from "zod";

export const HoldRequestSchema = z
  .object({
    eventId: z.guid(),
    seatIds: z.array(z.string().min(1)).min(1),
    ttlSeconds: z.number().int().positive().optional(),
    maxPerUser: z.number().int().positive().optional(),
  })
  .strict();

export type HoldRequest = z.infer<typeof HoldRequestSchema>;

export const HoldResponseSchema = z
  .object({
    eventId: z.guid().optional(),
    userId: z.guid().optional(),
    seatIds: z.array(z.string().min(1)),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type HoldResponse = z.infer<typeof HoldResponseSchema>;

export const EventSeatsHoldBodySchema = z
  .object({
    eventId: z.guid().optional(),
    seatIds: z.array(z.string().min(1)).min(1),
    ttlSeconds: z.number().int().positive().optional(),
    maxPerUser: z.number().int().positive().optional(),
  })
  .strict();

export type EventSeatsHoldBody = z.infer<typeof EventSeatsHoldBodySchema>;

export const ReleaseSeatsRequestSchema = z
  .object({
    eventId: z.guid().optional(),
    seatIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type ReleaseSeatsRequest = z.infer<typeof ReleaseSeatsRequestSchema>;

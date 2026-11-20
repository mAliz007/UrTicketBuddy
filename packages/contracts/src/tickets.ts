import { z } from "zod";
import { TicketStatus } from "./enums";

export { TicketStatus };

export enum ScanResult {
  VALID = "VALID",
  USED = "USED",
  INVALID = "INVALID",
  EXPIRED = "EXPIRED",
  WRONG_EVENT = "WRONG_EVENT",
}

export const DynamicQrResponseSchema = z.object({
  ticketId: z.string().uuid(),
  token: z.string(),
  expiresAt: z.string(),
  windowSeconds: z.number().default(30),
});

export type DynamicQrResponse = z.infer<typeof DynamicQrResponseSchema>;

export const GateScanRequestSchema = z.object({
  token: z.string().min(1),
  eventId: z.string().uuid(),
});

export type GateScanRequest = z.infer<typeof GateScanRequestSchema>;

export const GateScanResponseSchema = z.object({
  scanId: z.string().uuid().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid(),
  result: z.nativeEnum(ScanResult),
  scannedAt: z.string(),
  message: z.string(),
  seatId: z.string().optional(),
});

export type GateScanResponse = z.infer<typeof GateScanResponseSchema>;

export const TicketResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  eventSeatId: z.string().uuid(),
  orderId: z.string().uuid(),
  ownerId: z.string(),
  status: z.nativeEnum(TicketStatus),
  seedVersion: z.number().int(),
  faceValueMinor: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TicketResponse = z.infer<typeof TicketResponseSchema>;

export const TicketListResponseSchema = z.array(TicketResponseSchema);
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>;

export const GateMetricsResponseSchema = z.object({
  eventId: z.string().uuid(),
  totalScans: z.number(),
  validScans: z.number(),
  rejectedScans: z.number(),
  entryVelocityPerMinute: z.number(),
});

export type GateMetricsResponse = z.infer<typeof GateMetricsResponseSchema>;

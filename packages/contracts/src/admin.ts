import { z } from "zod";
import { PaginatedResult } from "./pagination";

export const UpdateCommissionRateSchema = z
  .object({
    commissionRatePercent: z.coerce.number().min(0).max(50).optional(),
    commissionRate: z.coerce.number().min(0).max(50).optional(),
    value: z.coerce.number().min(0).max(50).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.commissionRatePercent !== undefined ||
      data.commissionRate !== undefined ||
      data.value !== undefined,
    {
      message: "Commission rate must be specified between 0 and 50 percent",
    },
  );

export type UpdateCommissionRateDto = z.infer<
  typeof UpdateCommissionRateSchema
>;

export const AuditLogQuerySchema = z
  .object({
    actorId: z.string().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export const AdminReasonSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export type AdminReasonDto = z.infer<typeof AdminReasonSchema>;

export interface AuditLogDto {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: Date | string;
}

export type PaginatedAuditLogs = PaginatedResult<AuditLogDto>;

export interface FlagOrderResponse {
  success: boolean;
  orderId: string;
  status: string;
  invalidatedTicketsCount: number;
}

export interface RevokeTicketResponse {
  success: boolean;
  ticketId: string;
  status: string;
  seatId: string;
  eventId: string;
}

export interface CommissionSettingsResponse {
  key: string;
  commissionRatePercent: number;
  value: string;
}

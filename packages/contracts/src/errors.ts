import { z } from "zod";

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFLICT = "CONFLICT",
  SEAT_ALREADY_HELD = "SEAT_ALREADY_HELD",
  SEAT_ALREADY_SOLD = "SEAT_ALREADY_SOLD",
  HOLD_EXPIRED = "HOLD_EXPIRED",
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.nativeEnum(ErrorCode),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

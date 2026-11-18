import { z } from "zod";

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFLICT = "CONFLICT",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SEAT_ALREADY_HELD = "SEAT_ALREADY_HELD",
  SEAT_ALREADY_SOLD = "SEAT_ALREADY_SOLD",
  SEAT_NOT_HELD_BY_YOU = "SEAT_NOT_HELD_BY_YOU",
  HOLD_EXPIRED = "HOLD_EXPIRED",
  TOO_MANY_SEATS = "TOO_MANY_SEATS",
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

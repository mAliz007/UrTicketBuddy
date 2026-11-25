import { z } from "zod";

export const PG_MAX_INT32 = 2_147_483_647;

export enum ResaleListingStatus {
  ACTIVE = "ACTIVE",
  SOLD = "SOLD",
  WITHDRAWN = "WITHDRAWN",
}

export enum LedgerEntryKind {
  SELLER_PAYOUT = "SELLER_PAYOUT",
  PLATFORM_COMMISSION = "PLATFORM_COMMISSION",
}

export function maxResalePrice(faceValueMinor: number): number {
  if (!Number.isFinite(faceValueMinor) || faceValueMinor < 0) {
    throw new RangeError("faceValueMinor must be a non-negative finite number");
  }
  return Math.floor((Math.floor(faceValueMinor) * 110) / 100);
}

export const CreateResaleListingSchema = z
  .object({
    ticketId: z.string().uuid(),
    askingPriceMinor: z.number().int().positive().max(PG_MAX_INT32),
  })
  .strict();

export type CreateResaleListingDto = z.infer<typeof CreateResaleListingSchema>;

export const UpdateResaleListingSchema = z
  .object({
    askingPriceMinor: z.number().int().positive().max(PG_MAX_INT32).optional(),
    status: z.literal(ResaleListingStatus.WITHDRAWN).optional(),
  })
  .strict()
  .refine(
    (data) => data.askingPriceMinor !== undefined || data.status !== undefined,
    {
      message: "Must provide askingPriceMinor or status WITHDRAWN",
    },
  );

export type UpdateResaleListingDto = z.infer<typeof UpdateResaleListingSchema>;

export const PurchaseResaleListingSchema = z
  .object({
    paymentMethodToken: z.string().min(1).default("tok_visa"),
  })
  .strict();

export type PurchaseResaleListingDto = z.infer<
  typeof PurchaseResaleListingSchema
>;

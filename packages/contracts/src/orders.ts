import { z } from "zod";

export enum OrderStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  FLAGGED = "FLAGGED",
}

export const CheckoutRequestSchema = z
  .object({
    eventId: z.guid(),
    seatIds: z.array(z.string().min(1)).min(1),
    paymentMethodToken: z.string().min(1),
    userId: z.string().min(1).optional(),
  })
  .strict();

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const OrderItemDtoSchema = z.object({
  id: z.guid(),
  orderId: z.guid(),
  eventSeatId: z.guid(),
  price: z.number().positive(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});

export type OrderItemDto = z.infer<typeof OrderItemDtoSchema>;

export const OrderResponseSchema = z.object({
  id: z.guid(),
  userId: z.string(),
  eventId: z.guid(),
  totalAmount: z.number().nonnegative(),
  currency: z.string(),
  status: z.nativeEnum(OrderStatus),
  paymentGatewayRef: z.string().nullable().optional(),
  items: z.array(OrderItemDtoSchema).optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export type OrderResponse = z.infer<typeof OrderResponseSchema>;

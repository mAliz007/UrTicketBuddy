export interface CheckoutDto {
  eventId: string;
  seatIds: string[];
  paymentMethodToken: string;
  idempotencyKey?: string;
}

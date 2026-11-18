export interface CheckoutDto {
  eventId: string;
  seatIds: string[];
  paymentMethodToken: string;
  userId?: string;
}

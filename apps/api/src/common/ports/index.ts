export interface EventSeatCatalogPort {
  getSeatAvailability(
    eventId: string,
    seatIds: string[],
  ): Promise<Map<string, boolean>>;
}

export interface PlatformSettingsPort {
  getSetting<T>(key: string): Promise<T | null>;
}

export interface PaymentProvider {
  createPaymentIntent(
    amountMinorUnits: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<{ intentId: string; clientSecret: string }>;
  verifyWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<{ eventType: string; data: unknown }>;
}

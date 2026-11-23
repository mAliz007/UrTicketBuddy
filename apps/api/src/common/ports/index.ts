export interface EventSeatCatalogPort {
  getSeatAvailability(
    eventId: string,
    seatIds: string[],
  ): Promise<Map<string, boolean>>;
}

export interface PlatformSettingsPort {
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  getCommissionRate(): Promise<number>;
  setCommissionRate(rate: number): Promise<void>;
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

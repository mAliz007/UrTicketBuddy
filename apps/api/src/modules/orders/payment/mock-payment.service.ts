import { Injectable, Logger } from "@nestjs/common";
import { PaymentProvider } from "../../../common/ports";

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

@Injectable()
export class MockPaymentService implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentService.name);

  async createPaymentIntent(
    amountMinorUnits: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<{ intentId: string; clientSecret: string }> {
    const intentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      intentId,
      clientSecret: `${intentId}_secret_${idempotencyKey || "default"}`,
    };
  }

  async verifyWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<{ eventType: string; data: unknown }> {
    return {
      eventType: "payment_intent.succeeded",
      data: { payload: payload.toString(), signature },
    };
  }

  async processPayment(params: {
    amount: number;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey?: string;
  }): Promise<ChargeResult> {
    if (
      params.paymentMethodToken === "tok_fail" ||
      params.paymentMethodToken.startsWith("tok_err") ||
      params.amount <= 0
    ) {
      this.logger.warn(
        `Payment failed with token ${params.paymentMethodToken} for amount ${params.amount}`,
      );
      return {
        success: false,
        error: "Card declined or invalid payment token",
      };
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      success: true,
      transactionId,
    };
  }
}

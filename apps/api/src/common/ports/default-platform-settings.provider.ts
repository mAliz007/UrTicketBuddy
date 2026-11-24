import { Injectable } from "@nestjs/common";
import { PlatformSettingsPort } from "./index";

export const DEFAULT_COMMISSION_RATE_BPS = 1000; // 10%

@Injectable()
export class DefaultPlatformSettingsProvider implements PlatformSettingsPort {
  private readonly defaults: Record<string, unknown> = {
    commissionRateBps: DEFAULT_COMMISSION_RATE_BPS,
    commission_rate_percent: 10,
  };

  async getSetting<T>(key: string): Promise<T | null> {
    if (key in this.defaults) {
      return this.defaults[key] as T;
    }
    return null;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    this.defaults[key] = value;
  }

  async getCommissionRate(): Promise<number> {
    return 10;
  }

  async setCommissionRate(rate: number): Promise<void> {
    this.defaults["commission_rate_percent"] = rate;
    this.defaults["commissionRateBps"] = Math.round(rate * 100);
  }

  async getCommissionRateBps(): Promise<number> {
    return (
      (this.defaults["commissionRateBps"] as number) ??
      DEFAULT_COMMISSION_RATE_BPS
    );
  }
}

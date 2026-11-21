import { Injectable } from "@nestjs/common";
import { PlatformSettingsPort } from "./index";

export const DEFAULT_COMMISSION_RATE_BPS = 1000; // 10%

@Injectable()
export class DefaultPlatformSettingsProvider implements PlatformSettingsPort {
  private readonly defaults: Record<string, unknown> = {
    commissionRateBps: DEFAULT_COMMISSION_RATE_BPS,
  };

  async getSetting<T>(key: string): Promise<T | null> {
    if (key in this.defaults) {
      return this.defaults[key] as T;
    }
    return null;
  }

  async getCommissionRateBps(): Promise<number> {
    return DEFAULT_COMMISSION_RATE_BPS;
  }
}

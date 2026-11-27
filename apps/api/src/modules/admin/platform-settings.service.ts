import { Injectable, Inject, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { PlatformSetting } from "@urticketbuddy/db";
import { PlatformSettingsPort } from "../../common/ports";
import { PLATFORM_SETTING_REPOSITORY } from "../../database/database.tokens";

export const DEFAULT_COMMISSION_RATE = 10;
export const COMMISSION_SETTING_KEY = "commission_rate_percent";

@Injectable()
export class PlatformSettingsService implements PlatformSettingsPort {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @Inject(PLATFORM_SETTING_REPOSITORY)
    private readonly platformSettingRepository: Repository<PlatformSetting>,
  ) {}

  /**
   * Retrieves a setting value by key, returning parsed T or null.
   */
  async getSetting<T>(key: string): Promise<T | null> {
    if (
      !this.platformSettingRepository ||
      typeof this.platformSettingRepository.findOne !== "function"
    ) {
      return null;
    }
    const setting = await this.platformSettingRepository.findOne({
      where: { key },
    });
    if (!setting) {
      return null;
    }

    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return setting.value as unknown as T;
    }
  }

  /**
   * Upserts a setting value by key.
   */
  async setSetting<T>(key: string, value: T): Promise<void> {
    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value);

    let setting = await this.platformSettingRepository.findOne({
      where: { key },
    });
    if (setting) {
      setting.value = stringValue;
      await this.platformSettingRepository.save(setting);
    } else {
      setting = this.platformSettingRepository.create({
        key,
        value: stringValue,
      });
      await this.platformSettingRepository.save(setting);
    }

    this.logger.log(`[PlatformSettings] Set "${key}" to "${stringValue}"`);
  }

  /**
   * Returns current commission rate (0 to 50 percent). Defaults to 10.
   */
  async getCommissionRate(): Promise<number> {
    if (
      !this.platformSettingRepository ||
      typeof this.platformSettingRepository.findOne !== "function"
    ) {
      return DEFAULT_COMMISSION_RATE;
    }
    const setting = await this.platformSettingRepository.findOne({
      where: { key: COMMISSION_SETTING_KEY },
    });

    if (!setting) {
      return DEFAULT_COMMISSION_RATE;
    }

    const parsed = Number(setting.value);
    return isNaN(parsed) ? DEFAULT_COMMISSION_RATE : parsed;
  }

  /**
   * Updates commission rate (0 to 50 percent).
   */
  async setCommissionRate(rate: number): Promise<void> {
    if (rate < 0 || rate > 50) {
      throw new Error("Commission rate percent must be between 0 and 50");
    }

    await this.setSetting(COMMISSION_SETTING_KEY, rate.toString());
  }

  /**
   * Returns current commission rate in basis points (e.g. 10% = 1000 bps).
   */
  async getCommissionRateBps(): Promise<number> {
    const ratePercent = await this.getCommissionRate();
    return Math.round(ratePercent * 100);
  }
}

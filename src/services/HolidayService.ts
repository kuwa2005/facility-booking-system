import HolidayRepository from '../models/HolidayRepository';
import { Holiday } from '../models/types';

/**
 * 祝日管理サービス
 */
class HolidayService {
  /**
   * すべての祝日を取得
   */
  async getAllHolidays(): Promise<Holiday[]> {
    return await HolidayRepository.findAll();
  }

  /**
   * 年度別に祝日を取得
   */
  async getHolidaysByYear(year: number): Promise<Holiday[]> {
    if (year < 1900 || year > 2100) {
      throw new Error('Invalid year');
    }

    return await HolidayRepository.findByYear(year);
  }

  /**
   * IDで祝日を取得
   */
  async getHolidayById(id: number): Promise<Holiday | null> {
    return await HolidayRepository.findById(id);
  }

  /**
   * 祝日を作成
   */
  async createHoliday(data: {
    date: string;
    name: string;
    isRecurring?: boolean;
  }): Promise<Holiday> {
    // 日付の妥当性チェック
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date format');
    }

    // 名前の妥当性チェック
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Holiday name is required');
    }

    if (data.name.length > 255) {
      throw new Error('Holiday name is too long (max 255 characters)');
    }

    // 重複チェック
    const existing = await HolidayRepository.findByDate(data.date);
    if (existing) {
      throw new Error('Holiday already exists for this date');
    }

    return await HolidayRepository.create({
      date: data.date,
      name: data.name.trim(),
      isRecurring: data.isRecurring || false,
    });
  }

  /**
   * 祝日を更新
   */
  async updateHoliday(
    id: number,
    data: {
      date?: string;
      name?: string;
      isRecurring?: boolean;
    }
  ): Promise<Holiday> {
    // 祝日の存在確認
    const existing = await HolidayRepository.findById(id);
    if (!existing) {
      throw new Error('Holiday not found');
    }

    // 日付の妥当性チェック
    if (data.date) {
      const dateObj = new Date(data.date);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date format');
      }

      // 日付変更時の重複チェック
      const existingDateStr = existing.date.toISOString().split('T')[0];
      if (data.date !== existingDateStr) {
        const duplicate = await HolidayRepository.findByDate(data.date);
        if (duplicate) {
          throw new Error('Holiday already exists for this date');
        }
      }
    }

    // 名前の妥当性チェック
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Holiday name is required');
      }

      if (data.name.length > 255) {
        throw new Error('Holiday name is too long (max 255 characters)');
      }
    }

    await HolidayRepository.update(id, {
      date: data.date,
      name: data.name?.trim(),
      isRecurring: data.isRecurring,
    });

    const updated = await HolidayRepository.findById(id);
    if (!updated) {
      throw new Error('Failed to update holiday');
    }

    return updated;
  }

  /**
   * 祝日を削除
   */
  async deleteHoliday(id: number): Promise<void> {
    const existing = await HolidayRepository.findById(id);
    if (!existing) {
      throw new Error('Holiday not found');
    }

    await HolidayRepository.delete(id);
  }

  /**
   * 日付が祝日かどうかを判定
   */
  async isHoliday(date: string): Promise<boolean> {
    return await HolidayRepository.isHoliday(date);
  }

  /**
   * 日付が土日祝日かどうかを判定
   */
  async isWeekendOrHoliday(date: string): Promise<boolean> {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // 土曜日(6)または日曜日(0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }

    // 祝日チェック
    return await this.isHoliday(date);
  }

  /**
   * 複数の日付が土日祝日かどうかを判定
   */
  async checkWeekendOrHolidays(dates: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    // まず土日をチェック
    for (const date of dates) {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        result.set(date, true);
      } else {
        result.set(date, false);
      }
    }

    // 平日のみ祝日チェック
    const weekdayDates = dates.filter(date => !result.get(date));
    if (weekdayDates.length > 0) {
      const holidays = await HolidayRepository.checkHolidays(weekdayDates);
      for (const [date, isHoliday] of holidays.entries()) {
        if (isHoliday) {
          result.set(date, true);
        }
      }
    }

    return result;
  }
}

export default new HolidayService();

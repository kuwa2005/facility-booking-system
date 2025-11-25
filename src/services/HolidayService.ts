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

  /**
   * 指定した年の日本の祝日を生成
   */
  generateJapaneseHolidays(year: number): Array<{ date: string; name: string }> {
    const holidays: Array<{ date: string; name: string }> = [];

    // 固定祝日
    holidays.push({ date: `${year}-01-01`, name: '元日' });
    holidays.push({ date: `${year}-02-11`, name: '建国記念の日' });
    holidays.push({ date: `${year}-02-23`, name: '天皇誕生日' });
    holidays.push({ date: `${year}-04-29`, name: '昭和の日' });
    holidays.push({ date: `${year}-05-03`, name: '憲法記念日' });
    holidays.push({ date: `${year}-05-04`, name: 'みどりの日' });
    holidays.push({ date: `${year}-05-05`, name: 'こどもの日' });
    holidays.push({ date: `${year}-08-11`, name: '山の日' });
    holidays.push({ date: `${year}-11-03`, name: '文化の日' });
    holidays.push({ date: `${year}-11-23`, name: '勤労感謝の日' });

    // 移動祝日（ハッピーマンデー）
    holidays.push({ date: this.getNthMonday(year, 1, 2), name: '成人の日' }); // 1月第2月曜日
    holidays.push({ date: this.getNthMonday(year, 7, 3), name: '海の日' }); // 7月第3月曜日
    holidays.push({ date: this.getNthMonday(year, 9, 3), name: '敬老の日' }); // 9月第3月曜日
    holidays.push({ date: this.getNthMonday(year, 10, 2), name: 'スポーツの日' }); // 10月第2月曜日

    // 春分の日・秋分の日（簡易計算）
    holidays.push({ date: this.getVernalEquinoxDay(year), name: '春分の日' });
    holidays.push({ date: this.getAutumnalEquinoxDay(year), name: '秋分の日' });

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 指定月のn番目の月曜日を取得
   */
  private getNthMonday(year: number, month: number, nth: number): string {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() !== month - 1) break;

      if (date.getDay() === 1) { // Monday
        count++;
        if (count === nth) {
          return this.formatDate(date);
        }
      }
    }
    return '';
  }

  /**
   * 春分の日を計算（簡易式）
   */
  private getVernalEquinoxDay(year: number): string {
    let day: number;
    if (year >= 2000 && year <= 2099) {
      day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    } else if (year >= 1900 && year <= 1999) {
      day = Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    } else {
      day = 20; // デフォルト
    }
    return `${year}-03-${String(day).padStart(2, '0')}`;
  }

  /**
   * 秋分の日を計算（簡易式）
   */
  private getAutumnalEquinoxDay(year: number): string {
    let day: number;
    if (year >= 2000 && year <= 2099) {
      day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    } else if (year >= 1900 && year <= 1999) {
      day = Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    } else {
      day = 23; // デフォルト
    }
    return `${year}-09-${String(day).padStart(2, '0')}`;
  }

  /**
   * DateオブジェクトをYYYY-MM-DD形式に変換
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 指定した年の祝日を一括登録
   */
  async bulkRegisterYearHolidays(year: number): Promise<{ created: number; skipped: number; errors: string[] }> {
    if (year < 1900 || year > 2100) {
      throw new Error('Invalid year (must be between 1900 and 2100)');
    }

    const holidays = this.generateJapaneseHolidays(year);
    const result = {
      created: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const holiday of holidays) {
      try {
        // 既存チェック
        const existing = await HolidayRepository.findByDate(holiday.date);
        if (existing) {
          result.skipped++;
          continue;
        }

        // 登録
        await HolidayRepository.create({
          date: holiday.date,
          name: holiday.name,
        });
        result.created++;
      } catch (error: any) {
        result.errors.push(`${holiday.date} (${holiday.name}): ${error.message}`);
      }
    }

    return result;
  }
}

export default new HolidayService();

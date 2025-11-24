import { Request, Response, NextFunction } from 'express';
import HolidayService from '../services/HolidayService';

/**
 * 祝日管理コントローラー
 */
export class HolidayController {
  /**
   * すべての祝日を取得
   */
  static async getAllHolidays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { year } = req.query;

      let holidays;
      if (year) {
        const yearNum = parseInt(year as string);
        if (isNaN(yearNum)) {
          res.status(400).json({ error: 'Invalid year parameter' });
          return;
        }
        holidays = await HolidayService.getHolidaysByYear(yearNum);
      } else {
        holidays = await HolidayService.getAllHolidays();
      }

      res.json({ success: true, holidays });
    } catch (error) {
      next(error);
    }
  }

  /**
   * IDで祝日を取得
   */
  static async getHolidayById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid holiday ID' });
        return;
      }

      const holiday = await HolidayService.getHolidayById(id);
      if (!holiday) {
        res.status(404).json({ error: 'Holiday not found' });
        return;
      }

      res.json({ success: true, holiday });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 祝日を作成
   */
  static async createHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, name, isRecurring } = req.body;

      if (!date || !name) {
        res.status(400).json({ error: 'Date and name are required' });
        return;
      }

      const holiday = await HolidayService.createHoliday({
        date,
        name,
        isRecurring: isRecurring || false,
      });

      res.status(201).json({ success: true, holiday });
    } catch (error: any) {
      if (error.message === 'Holiday already exists for this date') {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * 祝日を更新
   */
  static async updateHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid holiday ID' });
        return;
      }

      const { date, name, isRecurring } = req.body;

      const holiday = await HolidayService.updateHoliday(id, {
        date,
        name,
        isRecurring,
      });

      res.json({ success: true, holiday });
    } catch (error: any) {
      if (error.message === 'Holiday not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'Holiday already exists for this date') {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * 祝日を削除
   */
  static async deleteHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid holiday ID' });
        return;
      }

      await HolidayService.deleteHoliday(id);

      res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Holiday not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * 日付が祝日かどうかをチェック
   */
  static async checkHoliday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.query;

      if (!date || typeof date !== 'string') {
        res.status(400).json({ error: 'Date parameter is required' });
        return;
      }

      const isHoliday = await HolidayService.isHoliday(date);

      res.json({ success: true, date, isHoliday });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 複数の日付が土日祝日かどうかをチェック
   */
  static async checkWeekendOrHolidays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dates } = req.body;

      if (!Array.isArray(dates)) {
        res.status(400).json({ error: 'Dates must be an array' });
        return;
      }

      const result = await HolidayService.checkWeekendOrHolidays(dates);

      // Mapをオブジェクトに変換
      const resultObj: Record<string, boolean> = {};
      for (const [date, isWeekendOrHoliday] of result.entries()) {
        resultObj[date] = isWeekendOrHoliday;
      }

      res.json({ success: true, dates: resultObj });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 指定した年の祝日を一括登録
   */
  static async bulkRegisterYearHolidays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { year } = req.body;

      if (!year || typeof year !== 'number') {
        res.status(400).json({ error: 'Year is required and must be a number' });
        return;
      }

      const result = await HolidayService.bulkRegisterYearHolidays(year);

      res.json({
        success: true,
        message: `${result.created}件の祝日を登録しました`,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

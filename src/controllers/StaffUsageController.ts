import { Request, Response, NextFunction } from 'express';
import StaffUsageManagementService from '../services/StaffUsageManagementService';

/**
 * 職員用利用記録管理コントローラー
 */
export class StaffUsageController {
  /**
   * 利用記録詳細を取得
   */
  static async getUsageDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const usageId = parseInt(id);

      if (isNaN(usageId)) {
        res.status(400).json({ error: 'Invalid usage ID' });
        return;
      }

      const detail = await StaffUsageManagementService.getUsageDetail(usageId);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }

  /**
   * エアコン使用時間を更新
   */
  static async updateAcHours(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { acHours } = req.body;
      const usageId = parseInt(id);

      if (isNaN(usageId)) {
        res.status(400).json({ error: 'Invalid usage ID' });
        return;
      }

      await StaffUsageManagementService.updateAcHours(usageId, req.user.userId, acHours);
      res.json({ message: 'AC hours updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 実際の使用時間を更新
   */
  static async updateActualTime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { actualStartTime, actualEndTime } = req.body;
      const usageId = parseInt(id);

      if (isNaN(usageId)) {
        res.status(400).json({ error: 'Invalid usage ID' });
        return;
      }

      await StaffUsageManagementService.updateActualTime(
        usageId,
        req.user.userId,
        actualStartTime,
        actualEndTime
      );

      res.json({ message: 'Actual time updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 備考を更新
   */
  static async updateRemarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { remarks } = req.body;
      const usageId = parseInt(id);

      if (isNaN(usageId)) {
        res.status(400).json({ error: 'Invalid usage ID' });
        return;
      }

      await StaffUsageManagementService.updateRemarks(usageId, req.user.userId, remarks);
      res.json({ message: 'Remarks updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 本日の利用一覧を取得
   */
  static async getTodayUsages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usages = await StaffUsageManagementService.getTodayUsages();
      res.json(usages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 期間内の利用一覧を取得
   */
  static async getUsagesByDateRange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const usages = await StaffUsageManagementService.getUsagesByDateRange(start, end);
      res.json(usages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * エアコン未入力の利用記録を取得
   */
  static async getUsagesWithMissingAcHours(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usages = await StaffUsageManagementService.getUsagesWithMissingAcHours();
      res.json(usages);
    } catch (error) {
      next(error);
    }
  }
}

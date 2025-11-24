import { Request, Response, NextFunction } from 'express';
import ActivityLogService from '../services/ActivityLogService';

/**
 * アクティビティログコントローラー
 */
export class ActivityLogController {
  /**
   * アクティビティログ一覧を取得
   */
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, actionType, staffId, limit, offset } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      if (actionType) filters.actionType = actionType as string;
      if (staffId) filters.staffId = parseInt(staffId as string);
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const logs = await ActivityLogService.getActivityLogs(filters);
      const totalCount = await ActivityLogService.getActivityLogCount(filters);

      res.json({
        success: true,
        logs,
        totalCount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * アクティビティログの統計情報を取得
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await ActivityLogService.getActivityStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

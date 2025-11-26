import { Request, Response, NextFunction } from 'express';
import UserActivityLogService from '../services/UserActivityLogService';

/**
 * ユーザーアクティビティログコントローラー
 * 一般ユーザーの行動ログを管理者が閲覧するため
 */
export class UserActivityLogController {
  /**
   * ユーザーアクティビティログ一覧を取得
   */
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, actionType, userId, limit, offset } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      if (actionType) filters.actionType = actionType as string;
      if (userId) filters.userId = parseInt(userId as string);
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const logs = await UserActivityLogService.getUserActivityLogs(filters);
      const totalCount = await UserActivityLogService.getUserActivityLogCount(filters);

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
   * ユーザーアクティビティログの統計情報を取得
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await UserActivityLogService.getUserActivityStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

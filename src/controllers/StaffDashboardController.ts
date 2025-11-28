import { Request, Response, NextFunction } from 'express';
import StaffDashboardService from '../services/StaffDashboardService';

/**
 * 職員ダッシュボードコントローラー
 */
export class StaffDashboardController {
  /**
   * ダッシュボード統計情報を取得
   */
  static async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await StaffDashboardService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 月別売上レポートを取得
   */
  static async getMonthlyRevenueReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await StaffDashboardService.getMonthlyRevenueReport();
      res.json(report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 日付範囲の売上レポートを取得
   */
  static async getRevenueByDateRange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required' });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const report = await StaffDashboardService.getRevenueByDateRange(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋別利用統計を取得
   */
  static async getRoomUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await StaffDashboardService.getRoomUsageStats(start, end);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import StaffUserManagementService from '../services/StaffUserManagementService';

/**
 * 職員用利用者管理コントローラー
 */
export class StaffUserController {
  /**
   * ユーザー一覧を取得
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, isActive, searchTerm, includeDeleted } = req.query;

      const filter: any = {};
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (searchTerm) filter.searchTerm = searchTerm;
      if (includeDeleted !== undefined) filter.includeDeleted = includeDeleted === 'true';

      const users = await StaffUserManagementService.getUsers(filter);
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ユーザー詳細を取得
   */
  static async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const detail = await StaffUserManagementService.getUserDetail(userId);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ユーザーのアクティブ状態を切り替え
   */
  static async toggleUserActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      await StaffUserManagementService.toggleUserActive(userId, req.user.userId);
      res.json({ message: 'User active status toggled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ユーザー情報を更新
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const { updates } = req.body;
      await StaffUserManagementService.updateUser(userId, req.user.userId, updates);
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ユーザー統計サマリーを取得
   */
  static async getUserStatsSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await StaffUserManagementService.getUserStatsSummary();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 最近登録されたユーザーを取得
   */
  static async getRecentUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 10;

      const users = await StaffUserManagementService.getRecentUsers(limitNum);
      res.json(users);
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import StaffManagementService from '../services/StaffManagementService';

/**
 * 職員管理コントローラー（管理者のみ使用可能）
 */
export class StaffManagementController {
  /**
   * 職員一覧を取得
   */
  static async getStaffList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const staff = await StaffManagementService.getStaffList(includeInactive === 'true');
      res.json(staff);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員詳細を取得
   */
  static async getStaffDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const staffId = parseInt(id);

      if (isNaN(staffId)) {
        res.status(400).json({ error: 'Invalid staff ID' });
        return;
      }

      const detail = await StaffManagementService.getStaffDetail(staffId);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員を登録
   */
  static async createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const {
        email,
        password,
        name,
        phone,
        role,
        staff_code,
        department,
        position,
        hire_date,
      } = req.body;

      if (!email || !password || !name || !phone || !role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      if (!['staff', 'admin'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      const staff = await StaffManagementService.createStaff(req.user.userId, {
        email,
        password,
        name,
        phone,
        role,
        staff_code,
        department,
        position,
        hire_date: hire_date ? new Date(hire_date) : undefined,
      });

      res.status(201).json(staff);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員情報を更新
   */
  static async updateStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const staffId = parseInt(id);

      if (isNaN(staffId)) {
        res.status(400).json({ error: 'Invalid staff ID' });
        return;
      }

      const updates = req.body;

      // hire_date を Date オブジェクトに変換
      if (updates.hire_date) {
        updates.hire_date = new Date(updates.hire_date);
      }

      await StaffManagementService.updateStaff(staffId, req.user.userId, updates);
      res.json({ message: 'Staff updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員を削除（論理削除）
   */
  static async deleteStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const staffId = parseInt(id);

      if (isNaN(staffId)) {
        res.status(400).json({ error: 'Invalid staff ID' });
        return;
      }

      await StaffManagementService.deleteStaff(staffId, req.user.userId);
      res.json({ message: 'Staff deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員のパスワードをリセット
   */
  static async resetStaffPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { newPassword } = req.body;
      const staffId = parseInt(id);

      if (isNaN(staffId)) {
        res.status(400).json({ error: 'Invalid staff ID' });
        return;
      }

      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      await StaffManagementService.resetStaffPassword(staffId, req.user.userId, newPassword);
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員統計サマリーを取得
   */
  static async getStaffStatsSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await StaffManagementService.getStaffStatsSummary();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員のアクティビティサマリーを取得
   */
  static async getStaffActivitySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : 30;

      const summary = await StaffManagementService.getStaffActivitySummary(daysNum);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}

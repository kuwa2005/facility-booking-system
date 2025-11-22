import { Request, Response, NextFunction } from 'express';
import StaffFacilityManagementService from '../services/StaffFacilityManagementService';

/**
 * 職員用施設・設備管理コントローラー
 */
export class StaffFacilityController {
  // ===== 部屋管理 =====

  /**
   * 部屋一覧を取得
   */
  static async getRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const rooms = await StaffFacilityManagementService.getRooms(includeInactive === 'true');
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋を作成
   */
  static async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roomData = req.body;
      const room = await StaffFacilityManagementService.createRoom(req.user.userId, roomData);
      res.status(201).json(room);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋を更新
   */
  static async updateRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const roomId = parseInt(id);

      if (isNaN(roomId)) {
        res.status(400).json({ error: 'Invalid room ID' });
        return;
      }

      const updates = req.body;
      await StaffFacilityManagementService.updateRoom(roomId, req.user.userId, updates);
      res.json({ message: 'Room updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋を削除
   */
  static async deleteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const roomId = parseInt(id);

      if (isNaN(roomId)) {
        res.status(400).json({ error: 'Invalid room ID' });
        return;
      }

      await StaffFacilityManagementService.deleteRoom(roomId, req.user.userId);
      res.json({ message: 'Room deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋を復元
   */
  static async restoreRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const roomId = parseInt(id);

      if (isNaN(roomId)) {
        res.status(400).json({ error: 'Invalid room ID' });
        return;
      }

      await StaffFacilityManagementService.restoreRoom(roomId, req.user.userId);
      res.json({ message: 'Room restored successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋を完全に削除
   */
  static async permanentlyDeleteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const roomId = parseInt(id);

      if (isNaN(roomId)) {
        res.status(400).json({ error: 'Invalid room ID' });
        return;
      }

      await StaffFacilityManagementService.permanentlyDeleteRoom(roomId, req.user.userId);
      res.json({ message: 'Room permanently deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋の利用統計を取得
   */
  static async getRoomUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const roomId = parseInt(id);

      if (isNaN(roomId)) {
        res.status(400).json({ error: 'Invalid room ID' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await StaffFacilityManagementService.getRoomUsageStats(roomId, start, end);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // ===== 設備管理 =====

  /**
   * 設備一覧を取得
   */
  static async getEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeDisabled } = req.query;
      const equipment = await StaffFacilityManagementService.getEquipment(includeDisabled === 'true');
      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 設備を作成
   */
  static async createEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const equipmentData = req.body;
      const equipment = await StaffFacilityManagementService.createEquipment(req.user.userId, equipmentData);
      res.status(201).json(equipment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 設備を更新
   */
  static async updateEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const equipmentId = parseInt(id);

      if (isNaN(equipmentId)) {
        res.status(400).json({ error: 'Invalid equipment ID' });
        return;
      }

      const updates = req.body;
      await StaffFacilityManagementService.updateEquipment(equipmentId, req.user.userId, updates);
      res.json({ message: 'Equipment updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 設備を削除
   */
  static async deleteEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const equipmentId = parseInt(id);

      if (isNaN(equipmentId)) {
        res.status(400).json({ error: 'Invalid equipment ID' });
        return;
      }

      await StaffFacilityManagementService.deleteEquipment(equipmentId, req.user.userId);
      res.json({ message: 'Equipment disabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 設備の利用統計を取得
   */
  static async getEquipmentUsageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const equipmentId = parseInt(id);

      if (isNaN(equipmentId)) {
        res.status(400).json({ error: 'Invalid equipment ID' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await StaffFacilityManagementService.getEquipmentUsageStats(equipmentId, start, end);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // ===== 休館日管理 =====

  /**
   * 休館日一覧を取得
   */
  static async getClosedDates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const closedDates = await StaffFacilityManagementService.getClosedDates(start, end);
      res.json(closedDates);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 休館日を追加
   */
  static async addClosedDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { date, reason } = req.body;

      if (!date || !reason) {
        res.status(400).json({ error: 'Date and reason are required' });
        return;
      }

      await StaffFacilityManagementService.addClosedDate(req.user.userId, {
        date: new Date(date),
        reason,
      });

      res.json({ message: 'Closed date added successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 休館日を削除
   */
  static async deleteClosedDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const closedDateId = parseInt(id);

      if (isNaN(closedDateId)) {
        res.status(400).json({ error: 'Invalid closed date ID' });
        return;
      }

      await StaffFacilityManagementService.deleteClosedDate(closedDateId, req.user.userId);
      res.json({ message: 'Closed date removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

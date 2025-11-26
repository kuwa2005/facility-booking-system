import { Request, Response, NextFunction } from 'express';
import RoomRepository from '../models/RoomRepository';
import EquipmentRepository from '../models/EquipmentRepository';
import AvailabilityRepository from '../models/AvailabilityRepository';
import { createError } from '../middleware/errorHandler';
import UserActivityLogService from '../services/UserActivityLogService';

export class RoomController {
  /**
   * Get all active rooms
   */
  static async getRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rooms = await RoomRepository.findAllActive();
      res.json({ rooms });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Get room by ID
   */
  static async getRoomById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const room = await RoomRepository.findById(parseInt(id, 10));

      if (!room) {
        next(createError('Room not found', 404));
        return;
      }

      res.json({ room });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Get room availability for a specific month
   */
  static async getRoomAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { year, month } = req.query;

      if (!year || !month) {
        next(createError('Year and month are required', 400));
        return;
      }

      const roomId = parseInt(id, 10);
      const yearNum = parseInt(year as string, 10);
      const monthNum = parseInt(month as string, 10);

      if (isNaN(roomId) || isNaN(yearNum) || isNaN(monthNum)) {
        next(createError('Invalid parameters', 400));
        return;
      }

      const room = await RoomRepository.findById(roomId);
      if (!room) {
        next(createError('Room not found', 404));
        return;
      }

      const availability = await AvailabilityRepository.getMonthAvailability(
        roomId,
        yearNum,
        monthNum
      );

      // 空室確認ログを記録
      if (req.user && req.user.role === 'user') {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');
        await UserActivityLogService.logAvailabilityCheck(
          req.user.userId,
          room.id,
          room.name,
          `${yearNum}-${monthNum}`,
          ipAddress,
          userAgent
        );
      }

      res.json({
        room: { id: room.id, name: room.name },
        year: yearNum,
        month: monthNum,
        availability,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Get all equipment
   */
  static async getEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const equipment = await EquipmentRepository.findAllEnabled();

      // Group by category
      const grouped = equipment.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof equipment>);

      res.json({ equipment: grouped });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import TimeSlotManagementService from '../services/TimeSlotManagementService';
import ProductManagementService from '../services/ProductManagementService';
import ProxyReservationService from '../services/ProxyReservationService';
import RoomEquipmentManagementService from '../services/RoomEquipmentManagementService';
import ExtendedClosureDateService from '../services/ExtendedClosureDateService';
import StaffUserManagementService from '../services/StaffUserManagementService';
import RoomRepository from '../models/RoomRepository';

/**
 * 拡張施設管理コントローラー
 * 時間帯管理、物販管理、予約代行、部屋設備管理、休館日管理などの機能を提供
 */
export class ExtendedFacilityController {
  // ===== 時間帯管理 =====

  static async getTimeSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const timeSlots = await TimeSlotManagementService.getTimeSlots(includeInactive === 'true');
      res.json(timeSlots);
    } catch (error) {
      next(error);
    }
  }

  static async createTimeSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const timeSlot = await TimeSlotManagementService.createTimeSlot(req.user.userId, req.body);
      res.status(201).json(timeSlot);
    } catch (error) {
      next(error);
    }
  }

  static async updateTimeSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      await TimeSlotManagementService.updateTimeSlot(parseInt(id), req.user.userId, req.body);
      res.json({ message: 'Time slot updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTimeSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      await TimeSlotManagementService.deleteTimeSlot(parseInt(id), req.user.userId);
      res.json({ message: 'Time slot deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async setRoomTimeSlotPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { roomId, timeSlotId } = req.params;
      const { basePrice, acPricePerHour, isAvailable } = req.body;

      await TimeSlotManagementService.setRoomTimeSlotPrices(
        parseInt(roomId),
        parseInt(timeSlotId),
        req.user.userId,
        basePrice,
        acPricePerHour,
        isAvailable
      );

      res.json({ message: 'Room time slot prices set successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getRoomTimeSlotPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;
      const prices = await TimeSlotManagementService.getRoomTimeSlotPrices(parseInt(roomId));
      res.json(prices);
    } catch (error) {
      next(error);
    }
  }

  // ===== 物販管理 =====

  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeUnavailable } = req.query;
      const products = await ProductManagementService.getProducts(includeUnavailable === 'true');
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const product = await ProductManagementService.createProduct(req.user.userId, req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      await ProductManagementService.updateProduct(parseInt(id), req.user.userId, req.body);
      res.json({ message: 'Product updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      await ProductManagementService.deleteProduct(parseInt(id), req.user.userId);
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const sale = await ProductManagementService.createSale(req.user.userId, req.body);
      res.status(201).json(sale);
    } catch (error) {
      next(error);
    }
  }

  static async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, productId, applicationId } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (productId) filters.productId = parseInt(productId as string);
      if (applicationId) filters.applicationId = parseInt(applicationId as string);

      const sales = await ProductManagementService.getSales(filters);
      res.json(sales);
    } catch (error) {
      next(error);
    }
  }

  static async getSalesStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await ProductManagementService.getSalesStats(start, end);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // ===== 予約代行 =====

  static async createProxyReservationForMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { userId, notes, ...applicationData } = req.body;

      const application = await ProxyReservationService.createForMember(
        req.user.userId,
        userId,
        applicationData,
        notes
      );

      res.status(201).json(application);
    } catch (error) {
      next(error);
    }
  }

  static async createProxyReservationForGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { notes, ...applicationData } = req.body;

      const application = await ProxyReservationService.createForGuest(
        req.user.userId,
        applicationData,
        notes
      );

      res.status(201).json(application);
    } catch (error) {
      next(error);
    }
  }

  static async getProxyReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { staffId } = req.query;

      const reservations = await ProxyReservationService.getProxyReservations(
        staffId ? parseInt(staffId as string) : undefined
      );

      res.json(reservations);
    } catch (error) {
      next(error);
    }
  }

  static async getProxyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { staffId } = req.query;

      const stats = await ProxyReservationService.getProxyStats(
        staffId ? parseInt(staffId as string) : undefined
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // ===== 部屋設備管理 =====

  static async getRoomEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;
      const equipment = await RoomEquipmentManagementService.getRoomEquipment(parseInt(roomId));
      res.json(equipment);
    } catch (error) {
      next(error);
    }
  }

  static async getEquipmentRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { equipmentId } = req.params;
      const rooms = await RoomEquipmentManagementService.getEquipmentRooms(parseInt(equipmentId));
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  }

  static async setRoomEquipmentBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { roomId } = req.params;
      const { equipmentIds } = req.body;

      await RoomEquipmentManagementService.setRoomEquipmentBulk(
        parseInt(roomId),
        equipmentIds,
        req.user.userId
      );

      res.json({ message: 'Room equipment updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async setEquipmentRoomsBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { equipmentId } = req.params;
      const { roomIds } = req.body;

      await RoomEquipmentManagementService.setEquipmentRoomsBulk(
        parseInt(equipmentId),
        roomIds,
        req.user.userId
      );

      res.json({ message: 'Equipment rooms updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ===== 休館日管理 =====

  static async addRoomClosedDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await ExtendedClosureDateService.addRoomClosedDate(req.user.userId, req.body);
      res.json({ message: 'Room closed date added successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getRoomClosedDates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId, startDate, endDate } = req.query;

      const closedDates = await ExtendedClosureDateService.getRoomClosedDates(
        roomId ? parseInt(roomId as string) : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(closedDates);
    } catch (error) {
      next(error);
    }
  }

  static async deleteRoomClosedDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      await ExtendedClosureDateService.deleteRoomClosedDate(parseInt(id), req.user.userId);
      res.json({ message: 'Room closed date removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ===== 会員管理（職員用） =====

  static async registerMemberByStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const member = await StaffUserManagementService.registerMemberByStaff(req.user.userId, req.body);
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  }

  static async withdrawMemberByStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { userId } = req.params;
      await StaffUserManagementService.withdrawMemberByStaff(parseInt(userId), req.user.userId);
      res.json({ message: 'Member withdrawn successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ===== 施設表示順管理 =====

  static async updateRoomsDisplayOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { orderUpdates } = req.body;

      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        res.status(400).json({ error: 'orderUpdates must be a non-empty array' });
        return;
      }

      await RoomRepository.updateBulkDisplayOrder(orderUpdates);
      res.json({ message: 'Room display order updated successfully' });
    } catch (error) {
      next(error);
    }
  }
}

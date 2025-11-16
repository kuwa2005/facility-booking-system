import { Request, Response, NextFunction } from 'express';
import ApplicationRepository from '../models/ApplicationRepository';
import RoomRepository from '../models/RoomRepository';
import EquipmentRepository from '../models/EquipmentRepository';
import { calculateCancellationFee } from '../utils/pricing';
import { createError } from '../middleware/errorHandler';
import EmailService from '../services/EmailService';
import PaymentService from '../services/PaymentService';

export class AdminController {
  /**
   * Get all applications with filters
   */
  static async getApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, roomId, paymentStatus, cancelStatus, searchTerm } = req.query;

      const applications = await ApplicationRepository.findAll({
        startDate: startDate as string,
        endDate: endDate as string,
        roomId: roomId ? parseInt(roomId as string, 10) : undefined,
        paymentStatus: paymentStatus as string,
        cancelStatus: cancelStatus as string,
        searchTerm: searchTerm as string,
      });

      res.json({ applications });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Get application details
   */
  static async getApplicationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('Application not found', 404));
        return;
      }

      res.json(result);
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Update application
   */
  static async updateApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const application = await ApplicationRepository.update(parseInt(id, 10), updates);

      res.json({
        message: 'Application updated successfully',
        application,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Cancel application
   */
  static async cancelApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));
      if (!result) {
        next(createError('Application not found', 404));
        return;
      }

      if (result.application.cancel_status === 'cancelled') {
        next(createError('Application already cancelled', 400));
        return;
      }

      // Calculate cancellation fee
      let totalCancellationFee = 0;
      const cancelledAt = new Date();

      for (const usage of result.usages) {
        const fee = calculateCancellationFee(
          usage.date,
          cancelledAt,
          usage.subtotal_amount
        );
        totalCancellationFee += fee;
      }

      // Cancel application
      const application = await ApplicationRepository.cancel(
        parseInt(id, 10),
        totalCancellationFee
      );

      // Refund if applicable
      if (application.payment_status === 'paid' && application.payment_provider_id) {
        const refundAmount = application.total_amount - totalCancellationFee;
        if (refundAmount > 0) {
          await PaymentService.refundPayment(
            application.payment_provider_id,
            refundAmount
          );
          await ApplicationRepository.updatePaymentStatus(
            parseInt(id, 10),
            'refunded',
            application.payment_provider_id
          );
        }
      }

      // Send cancellation email
      await EmailService.sendCancellationNotification(
        application.applicant_email,
        application.applicant_representative,
        application.id,
        application.event_name,
        totalCancellationFee
      );

      res.json({
        message: 'Application cancelled successfully',
        application,
        cancellation_fee: totalCancellationFee,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Update AC hours for a usage
   */
  static async updateAcHours(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { usageId } = req.params;
      const { ac_hours } = req.body;

      // TODO: Implement usage repository update
      // For now, use raw query
      const pool = (await import('../config/database')).default;

      await pool.query(
        'UPDATE usages SET ac_hours = ? WHERE id = ?',
        [ac_hours, parseInt(usageId, 10)]
      );

      // Recalculate charges
      // TODO: Implement full recalculation

      res.json({
        message: 'AC hours updated successfully',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Room management
   */
  static async getAllRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rooms = await RoomRepository.findAll();
      res.json({ rooms });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  static async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await RoomRepository.create(req.body);
      res.status(201).json({ message: 'Room created successfully', room });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  static async updateRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const room = await RoomRepository.update(parseInt(id, 10), req.body);
      res.json({ message: 'Room updated successfully', room });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  static async deleteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await RoomRepository.softDelete(parseInt(id, 10));
      res.json({ message: 'Room deleted successfully' });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Equipment management
   */
  static async getAllEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const equipment = await EquipmentRepository.findAll();
      res.json({ equipment });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  static async createEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const equipment = await EquipmentRepository.create(req.body);
      res.status(201).json({ message: 'Equipment created successfully', equipment });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  static async updateEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const equipment = await EquipmentRepository.update(parseInt(id, 10), req.body);
      res.json({ message: 'Equipment updated successfully', equipment });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  static async deleteEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await EquipmentRepository.softDelete(parseInt(id, 10));
      res.json({ message: 'Equipment deleted successfully' });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import StaffReservationManagementService from '../services/StaffReservationManagementService';

/**
 * 職員用予約管理コントローラー
 */
export class StaffReservationController {
  /**
   * 予約一覧を取得
   */
  static async getReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        status,
        paymentStatus,
        roomId,
        userId,
        startDate,
        endDate,
        searchTerm,
      } = req.query;

      const filter: any = {};

      if (status) filter.status = status;
      if (paymentStatus) filter.paymentStatus = paymentStatus;
      if (roomId) filter.roomId = parseInt(roomId as string);
      if (userId) filter.userId = parseInt(userId as string);
      if (startDate) filter.startDate = new Date(startDate as string);
      if (endDate) filter.endDate = new Date(endDate as string);
      if (searchTerm) filter.searchTerm = searchTerm;

      const reservations = await StaffReservationManagementService.getReservations(filter);
      res.json(reservations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 予約詳細を取得
   */
  static async getReservationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      const detail = await StaffReservationManagementService.getReservationDetail(applicationId);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 予約をキャンセル
   */
  static async cancelReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      await StaffReservationManagementService.cancelReservation(
        applicationId,
        req.user.userId,
        reason
      );

      res.json({ message: 'Reservation cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 決済ステータスを更新
   */
  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { paymentStatus, note } = req.body;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      if (!['unpaid', 'paid', 'refunded'].includes(paymentStatus)) {
        res.status(400).json({ error: 'Invalid payment status' });
        return;
      }

      await StaffReservationManagementService.updatePaymentStatus(
        applicationId,
        req.user.userId,
        paymentStatus,
        note
      );

      res.json({ message: 'Payment status updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 予約情報を更新
   */
  static async updateReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { updates, note } = req.body;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      await StaffReservationManagementService.updateReservation(
        applicationId,
        req.user.userId,
        updates,
        note
      );

      res.json({ message: 'Reservation updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * メモを追加
   */
  static async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { note, isImportant } = req.body;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      if (!note || note.trim().length === 0) {
        res.status(400).json({ error: 'Note text is required' });
        return;
      }

      await StaffReservationManagementService.addNote(
        req.user.userId,
        'application',
        applicationId,
        note,
        isImportant || false
      );

      res.json({ message: 'Note added successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * メモを取得
   */
  static async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const applicationId = parseInt(id);

      if (isNaN(applicationId)) {
        res.status(400).json({ error: 'Invalid application ID' });
        return;
      }

      const notes = await StaffReservationManagementService.getNotes('application', applicationId);
      res.json(notes);
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import ApplicationRepository from '../models/ApplicationRepository';
import { createError } from '../middleware/errorHandler';
import { calculateCancellationFee } from '../utils/pricing';
import PaymentService from '../services/PaymentService';
import { emailService } from '../services/EmailService';

export class UserReservationController {
  /**
   * ユーザーの予約一覧を取得
   */
  static async getMyReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { status, startDate, endDate } = req.query;
      const pool = (await import('../config/database')).default;

      let query = `
        SELECT a.*,
               (SELECT COUNT(*) FROM usages WHERE application_id = a.id) as usage_count,
               (SELECT MIN(date) FROM usages WHERE application_id = a.id) as first_date,
               (SELECT MAX(date) FROM usages WHERE application_id = a.id) as last_date
        FROM applications a
        WHERE a.user_id = ?
      `;
      const params: any[] = [req.user.userId];

      if (status === 'upcoming') {
        query += ` AND a.cancel_status = 'none' AND EXISTS (
          SELECT 1 FROM usages WHERE application_id = a.id AND date >= CURDATE()
        )`;
      } else if (status === 'past') {
        query += ` AND a.cancel_status = 'none' AND NOT EXISTS (
          SELECT 1 FROM usages WHERE application_id = a.id AND date >= CURDATE()
        )`;
      } else if (status === 'cancelled') {
        query += ` AND a.cancel_status = 'cancelled'`;
      }

      if (startDate) {
        query += ` AND EXISTS (
          SELECT 1 FROM usages WHERE application_id = a.id AND date >= ?
        )`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND EXISTS (
          SELECT 1 FROM usages WHERE application_id = a.id AND date <= ?
        )`;
        params.push(endDate);
      }

      query += ` ORDER BY a.created_at DESC`;

      const [applications] = await pool.query(query, params);

      res.json({ applications });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 予約詳細を取得
   */
  static async getReservationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { id } = req.params;
      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      // 自分の予約かチェック
      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      // 部屋情報を取得
      const RoomRepository = (await import('../models/RoomRepository')).default;
      const EquipmentRepository = (await import('../models/EquipmentRepository')).default;

      const usagesWithDetails = await Promise.all(
        result.usages.map(async (usage) => {
          const room = await RoomRepository.findById(usage.room_id);
          const equipmentIds = usage.equipment.map((e) => e.equipment_id);
          const equipmentItems = equipmentIds.length > 0
            ? await EquipmentRepository.findByIds(equipmentIds)
            : [];

          return {
            ...usage,
            room,
            equipmentDetails: usage.equipment.map((eq) => {
              const item = equipmentItems.find((e) => e.id === eq.equipment_id);
              return {
                ...eq,
                equipment: item,
              };
            }),
          };
        })
      );

      res.json({
        application: result.application,
        usages: usagesWithDetails,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 予約をキャンセル
   */
  static async cancelReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;

      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      // 自分の予約かチェック
      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      // 既にキャンセル済みかチェック
      if (result.application.cancel_status === 'cancelled') {
        next(createError('この予約は既にキャンセルされています', 400));
        return;
      }

      // キャンセル料を計算
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

      // キャンセルを記録
      const pool = (await import('../config/database')).default;

      // キャンセル処理
      await ApplicationRepository.cancel(parseInt(id, 10), totalCancellationFee);

      // 変更履歴を記録
      await pool.query(
        `INSERT INTO application_modifications (application_id, modified_by, modification_type, reason)
         VALUES (?, ?, 'cancel', ?)`,
        [parseInt(id, 10), req.user.userId, reason || 'ユーザーによるキャンセル']
      );

      // 返金処理
      if (result.application.payment_status === 'paid' && result.application.payment_provider_id) {
        const refundAmount = result.application.total_amount - totalCancellationFee;
        if (refundAmount > 0) {
          await PaymentService.refundPayment(
            result.application.payment_provider_id,
            refundAmount
          );
          await ApplicationRepository.updatePaymentStatus(
            parseInt(id, 10),
            'refunded',
            result.application.payment_provider_id
          );
        }
      }

      // キャンセル通知メールを送信
      await emailService.sendCancellationNotification(
        result.application.applicant_email,
        result.application.applicant_representative,
        result.application.id,
        result.application.event_name,
        totalCancellationFee
      );

      res.json({
        message: '予約をキャンセルしました',
        cancellation_fee: totalCancellationFee,
        refund_amount: result.application.total_amount - totalCancellationFee,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * 予約を変更（新規予約として作成し、元の予約をキャンセル）
   */
  static async modifyReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { id } = req.params;
      const newReservationData = req.body;

      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      // 自分の予約かチェック
      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      // 既にキャンセル済みかチェック
      if (result.application.cancel_status === 'cancelled') {
        next(createError('キャンセル済みの予約は変更できません', 400));
        return;
      }

      // 使用日が過去の場合は変更不可
      const hasPassedDates = result.usages.some((usage) => {
        const usageDate = new Date(usage.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return usageDate < today;
      });

      if (hasPassedDates) {
        next(createError('過去の予約は変更できません', 400));
        return;
      }

      res.json({
        message: '予約の変更は新規予約として作成してください',
        note: '現在の予約は手動でキャンセルし、新しい予約を作成してください',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * 予約の変更可能性をチェック
   */
  static async checkModifiable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { id } = req.params;
      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      // 自分の予約かチェック
      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      const reasons: string[] = [];
      let canModify = true;
      let canCancel = true;

      // キャンセル済みかチェック
      if (result.application.cancel_status === 'cancelled') {
        canModify = false;
        canCancel = false;
        reasons.push('既にキャンセルされています');
      }

      // 過去の日付かチェック
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const hasPassedDates = result.usages.some((usage) => {
        const usageDate = new Date(usage.date);
        return usageDate < today;
      });

      if (hasPassedDates) {
        canModify = false;
        canCancel = false;
        reasons.push('使用日が過去になっています');
      }

      // 当日の場合
      const hasToday = result.usages.some((usage) => {
        const usageDate = new Date(usage.date);
        usageDate.setHours(0, 0, 0, 0);
        return usageDate.getTime() === today.getTime();
      });

      if (hasToday) {
        canModify = false;
        reasons.push('使用日当日の変更はできません');
      }

      res.json({
        canModify,
        canCancel,
        reasons: reasons.length > 0 ? reasons : undefined,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }
}

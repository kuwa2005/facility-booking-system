import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import ApplicationRepository from '../models/ApplicationRepository';
import PaymentService from './PaymentService';

export interface ReservationFilter {
  status?: 'all' | 'upcoming' | 'past' | 'cancelled';
  paymentStatus?: 'all' | 'unpaid' | 'paid' | 'refunded';
  cancelStatus?: 'none' | 'cancelled';
  roomId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface ReservationListItem {
  id: number;
  eventName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  totalAmount: number;
  paymentStatus: string;
  cancelStatus: string;
  createdAt: Date;
  firstUsageDate: Date | null;
  lastUsageDate: Date | null;
  roomNames: string;
  userId: number | null;
  userName: string | null;
  usageDates?: string[];
  rooms?: string[];
}

/**
 * 職員用予約管理サービス
 */
export class StaffReservationManagementService {
  /**
   * Convert snake_case usage to camelCase
   */
  private usageToCamelCase(usage: any): any {
    return {
      id: usage.id,
      applicationId: usage.application_id,
      roomId: usage.room_id,
      date: usage.date,
      useMorning: usage.use_morning,
      useAfternoon: usage.use_afternoon,
      useEvening: usage.use_evening,
      useMiddayExtension: usage.use_midday_extension,
      useEveningExtension: usage.use_evening_extension,
      acRequested: usage.ac_requested,
      acHours: usage.ac_hours,
      roomBaseChargeBeforeMultiplier: usage.room_base_charge_before_multiplier,
      roomChargeAfterMultiplier: usage.room_charge_after_multiplier,
      equipmentCharge: usage.equipment_charge,
      acCharge: usage.ac_charge,
      subtotalAmount: usage.subtotal_amount,
      roomName: usage.room_name,
      capacity: usage.capacity,
      createdAt: usage.created_at,
      updatedAt: usage.updated_at,
    };
  }

  /**
   * 予約一覧を取得（フィルタ・検索機能付き）
   */
  async getReservations(filter: ReservationFilter = {}): Promise<ReservationListItem[]> {
    let query = `
      SELECT
        a.id,
        a.event_name,
        a.applicant_representative,
        a.applicant_email,
        a.applicant_phone,
        a.total_amount,
        a.payment_status,
        a.cancel_status,
        a.created_at,
        a.user_id,
        u.name as user_name,
        MIN(us.date) as first_usage_date,
        MAX(us.date) as last_usage_date,
        GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') as room_names
      FROM applications a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN usages us ON a.id = us.application_id
      LEFT JOIN rooms r ON us.room_id = r.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // ステータスフィルタ
    if (filter.status === 'upcoming') {
      query += ' AND EXISTS (SELECT 1 FROM usages us2 WHERE us2.application_id = a.id AND us2.date >= CURDATE())';
      query += ' AND a.cancel_status = "none"';
    } else if (filter.status === 'past') {
      query += ' AND NOT EXISTS (SELECT 1 FROM usages us2 WHERE us2.application_id = a.id AND us2.date >= CURDATE())';
      query += ' AND a.cancel_status = "none"';
    } else if (filter.status === 'cancelled') {
      query += ' AND a.cancel_status = "cancelled"';
    }

    // キャンセルステータスフィルタ（statusと独立して使用可能）
    if (filter.cancelStatus) {
      query += ' AND a.cancel_status = ?';
      params.push(filter.cancelStatus);
    }

    // 決済ステータスフィルタ
    if (filter.paymentStatus && filter.paymentStatus !== 'all') {
      query += ' AND a.payment_status = ?';
      params.push(filter.paymentStatus);
    }

    // 部屋フィルタ
    if (filter.roomId) {
      query += ' AND EXISTS (SELECT 1 FROM usages us3 WHERE us3.application_id = a.id AND us3.room_id = ?)';
      params.push(filter.roomId);
    }

    // ユーザーフィルタ
    if (filter.userId) {
      query += ' AND a.user_id = ?';
      params.push(filter.userId);
    }

    // 日付フィルタ
    if (filter.startDate) {
      query += ' AND EXISTS (SELECT 1 FROM usages us4 WHERE us4.application_id = a.id AND us4.date >= ?)';
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      query += ' AND EXISTS (SELECT 1 FROM usages us5 WHERE us5.application_id = a.id AND us5.date <= ?)';
      params.push(filter.endDate);
    }

    // 検索キーワード
    if (filter.searchTerm) {
      query += ` AND (
        a.event_name LIKE ? OR
        a.applicant_representative LIKE ? OR
        a.applicant_email LIKE ? OR
        a.applicant_phone LIKE ?
      )`;
      const searchPattern = `%${filter.searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += `
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows.map(row => {
      // Format usage dates for display
      const usageDates: string[] = [];
      if (row.first_usage_date) {
        const firstDate = new Date(row.first_usage_date);
        if (row.last_usage_date) {
          const lastDate = new Date(row.last_usage_date);
          if (firstDate.getTime() === lastDate.getTime()) {
            usageDates.push(firstDate.toLocaleDateString('ja-JP'));
          } else {
            usageDates.push(`${firstDate.toLocaleDateString('ja-JP')} 〜 ${lastDate.toLocaleDateString('ja-JP')}`);
          }
        } else {
          usageDates.push(firstDate.toLocaleDateString('ja-JP'));
        }
      }

      // Format room names into array
      const rooms = row.room_names ? row.room_names.split(', ') : [];

      return {
        id: row.id,
        eventName: row.event_name,
        applicantName: row.applicant_representative,
        applicantEmail: row.applicant_email,
        applicantPhone: row.applicant_phone,
        totalAmount: row.total_amount,
        paymentStatus: row.payment_status,
        cancelStatus: row.cancel_status,
        createdAt: row.created_at,
        firstUsageDate: row.first_usage_date,
        lastUsageDate: row.last_usage_date,
        roomNames: row.room_names || '',
        userId: row.user_id,
        userName: row.user_name,
        usageDates,
        rooms,
      };
    });
  }

  /**
   * 予約詳細を取得
   */
  async getReservationDetail(applicationId: number): Promise<any> {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error('Reservation not found');
    }

    // 利用情報を取得
    const [usages] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         r.name as room_name,
         r.capacity
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       WHERE u.application_id = ?
       ORDER BY u.date, r.name`,
      [applicationId]
    );

    // Convert usages to camelCase
    const usagesCamelCase = usages.map(usage => this.usageToCamelCase(usage));

    // 設備利用情報を取得
    const [equipmentUsages] = await pool.query<RowDataPacket[]>(
      `SELECT
         ue.*,
         e.name as equipment_name,
         e.category,
         e.price_type,
         e.unit_price
       FROM usage_equipment ue
       JOIN equipment e ON ue.equipment_id = e.id
       WHERE ue.usage_id IN (SELECT id FROM usages WHERE application_id = ?)`,
      [applicationId]
    );

    // ユーザー情報を取得
    let user = null;
    if (application.user_id) {
      const [userRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, email, name, phone, organization_name FROM users WHERE id = ?',
        [application.user_id]
      );
      user = userRows[0] || null;
    }

    return {
      application,
      usages: usagesCamelCase,
      equipmentUsages,
      user,
    };
  }

  /**
   * 職員による予約キャンセル
   */
  async cancelReservation(applicationId: number, staffId: number, reason?: string): Promise<void> {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error('Reservation not found');
    }

    if (application.cancel_status === 'cancelled') {
      throw new Error('Reservation is already cancelled');
    }

    // 利用日を確認
    const [usages] = await pool.query<RowDataPacket[]>(
      'SELECT MIN(date) as first_date FROM usages WHERE application_id = ?',
      [applicationId]
    );

    const firstUsageDate = usages[0]?.first_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // キャンセル料を計算
    let cancellationFee = 0;
    if (firstUsageDate && new Date(firstUsageDate) <= today) {
      // 利用日当日または過去の場合は100%キャンセル料
      cancellationFee = application.total_amount;
    }

    // 返金処理
    const refundAmount = application.total_amount - cancellationFee;
    if (refundAmount > 0 && application.payment_status === 'paid') {
      // TODO: Implement PaymentService.processRefund method
      // await PaymentService.processRefund(
      //   application.payment_provider_id || '',
      //   refundAmount,
      //   `Cancelled by staff (ID: ${staffId})`
      // );
      await ApplicationRepository.update(applicationId, { payment_status: 'refunded' });
    }

    // 予約をキャンセル
    await ApplicationRepository.update(applicationId, {
      cancel_status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_fee: cancellationFee,
    });

    // アクティビティログに記録
    await this.logActivity(staffId, 'cancel', 'application', applicationId, reason || 'Cancelled by staff');
  }

  /**
   * 予約の決済ステータスを手動更新
   */
  async updatePaymentStatus(
    applicationId: number,
    staffId: number,
    paymentStatus: 'unpaid' | 'paid' | 'refunded',
    note?: string
  ): Promise<void> {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error('Reservation not found');
    }

    await ApplicationRepository.update(applicationId, { payment_status: paymentStatus });

    await this.logActivity(
      staffId,
      'update',
      'application',
      applicationId,
      `Payment status updated to ${paymentStatus}. ${note || ''}`
    );
  }

  /**
   * 予約情報の更新（職員による調整）
   */
  async updateReservation(
    applicationId: number,
    staffId: number,
    updates: Partial<any>,
    note?: string
  ): Promise<void> {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error('Reservation not found');
    }

    await ApplicationRepository.update(applicationId, updates);

    await this.logActivity(
      staffId,
      'update',
      'application',
      applicationId,
      `Reservation updated: ${JSON.stringify(updates)}. ${note || ''}`
    );
  }

  /**
   * アクティビティログを記録
   */
  private async logActivity(
    staffId: number,
    actionType: string,
    targetType: string,
    targetId: number,
    description: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, actionType, targetType, targetId, description]
    );
  }

  /**
   * 職員メモを追加
   */
  async addNote(
    staffId: number,
    noteType: 'application' | 'user' | 'usage',
    referenceId: number,
    noteText: string,
    isImportant: boolean = false
  ): Promise<void> {
    await pool.query(
      `INSERT INTO staff_notes (staff_id, note_type, reference_id, note, is_important)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, noteType, referenceId, noteText, isImportant]
    );
  }

  /**
   * 職員メモを取得
   */
  async getNotes(noteType: 'application' | 'user' | 'usage', referenceId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         sn.*,
         u.name as staff_name
       FROM staff_notes sn
       JOIN users u ON sn.staff_id = u.id
       WHERE sn.note_type = ? AND sn.reference_id = ?
       ORDER BY sn.is_important DESC, sn.created_at DESC`,
      [noteType, referenceId]
    );

    return rows;
  }
}

export default new StaffReservationManagementService();

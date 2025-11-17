import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import UsageRepository from '../models/UsageRepository';
import RoomRepository from '../models/RoomRepository';
import { calculateUsageCharges } from '../utils/pricing';

export interface UpdateUsageDto {
  acHours?: number | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  remarks?: string | null;
}

/**
 * 職員用利用記録管理サービス
 */
export class StaffUsageManagementService {
  /**
   * 利用記録の詳細を取得
   */
  async getUsageDetail(usageId: number): Promise<any> {
    const usage = await UsageRepository.findById(usageId);
    if (!usage) {
      throw new Error('Usage record not found');
    }

    // 部屋情報を取得
    const room = await RoomRepository.findById(usage.room_id);

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
       WHERE ue.usage_id = ?`,
      [usageId]
    );

    // 申請情報を取得
    const [applications] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM applications WHERE id = ?',
      [usage.application_id]
    );

    return {
      usage,
      room,
      equipmentUsages,
      application: applications[0] || null,
    };
  }

  /**
   * エアコン使用時間を入力
   */
  async updateAcHours(
    usageId: number,
    staffId: number,
    acHours: number | null
  ): Promise<void> {
    const usage = await UsageRepository.findById(usageId);
    if (!usage) {
      throw new Error('Usage record not found');
    }

    if (!usage.ac_requested && acHours !== null) {
      throw new Error('Air conditioning was not requested for this usage');
    }

    if (acHours !== null && acHours < 0) {
      throw new Error('AC hours cannot be negative');
    }

    await UsageRepository.update(usageId, { ac_hours: acHours });

    // 料金を再計算
    await this.recalculateTotalAmount(usage.application_id, staffId);

    // アクティビティログに記録
    await this.logActivity(
      staffId,
      'update',
      'usage',
      usageId,
      `AC hours updated to ${acHours}`
    );
  }

  /**
   * 実際の使用時間を入力
   */
  async updateActualTime(
    usageId: number,
    staffId: number,
    actualStartTime: string | null,
    actualEndTime: string | null
  ): Promise<void> {
    const usage = await UsageRepository.findById(usageId);
    if (!usage) {
      throw new Error('Usage record not found');
    }

    await UsageRepository.update(usageId, {
      actual_start_time: actualStartTime,
      actual_end_time: actualEndTime,
    });

    await this.logActivity(
      staffId,
      'update',
      'usage',
      usageId,
      `Actual time updated: ${actualStartTime} - ${actualEndTime}`
    );
  }

  /**
   * 利用記録の備考を更新
   */
  async updateRemarks(
    usageId: number,
    staffId: number,
    remarks: string | null
  ): Promise<void> {
    const usage = await UsageRepository.findById(usageId);
    if (!usage) {
      throw new Error('Usage record not found');
    }

    await UsageRepository.update(usageId, { remarks });

    await this.logActivity(
      staffId,
      'update',
      'usage',
      usageId,
      'Remarks updated'
    );
  }

  /**
   * 予約の合計金額を再計算
   */
  async recalculateTotalAmount(applicationId: number, staffId: number): Promise<number> {
    // 申請情報を取得
    const [applications] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM applications WHERE id = ?',
      [applicationId]
    );

    if (applications.length === 0) {
      throw new Error('Application not found');
    }

    const application = applications[0];

    // 利用記録を取得
    const [usages] = await pool.query<RowDataPacket[]>(
      `SELECT u.*, r.*
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       WHERE u.application_id = ?`,
      [applicationId]
    );

    let totalAmount = 0;

    for (const usage of usages) {
      // 各利用の料金を計算
      const usageInput = {
        date: usage.date,
        useMorning: usage.use_morning,
        useAfternoon: usage.use_afternoon,
        useEvening: usage.use_evening,
        useMiddayExtension: usage.use_midday_extension,
        useEveningExtension: usage.use_evening_extension,
        acRequested: usage.ac_requested,
        acHours: usage.ac_hours,
      };

      // 設備利用情報を取得
      const [equipments] = await pool.query<RowDataPacket[]>(
        `SELECT ue.*, e.price_type, e.unit_price
         FROM usage_equipment ue
         JOIN equipment e ON ue.equipment_id = e.id
         WHERE ue.usage_id = ?`,
        [usage.id]
      );

      const equipmentUsages = equipments.map(eq => ({
        equipmentId: eq.equipment_id,
        quantity: eq.quantity,
        priceType: eq.price_type,
        unitPrice: eq.unit_price,
      }));

      const room = {
        id: usage.room_id,
        name: usage.name,
        capacity: usage.capacity,
        base_price_morning: usage.base_price_morning,
        base_price_afternoon: usage.base_price_afternoon,
        base_price_evening: usage.base_price_evening,
        extension_price_midday: usage.extension_price_midday,
        extension_price_evening: usage.extension_price_evening,
        ac_price_per_hour: usage.ac_price_per_hour,
        description: usage.description,
        is_active: usage.is_active,
        created_at: usage.created_at,
        updated_at: usage.updated_at,
      };

      const charges = calculateUsageCharges(
        room,
        usageInput,
        equipmentUsages,
        application.ticket_multiplier
      );

      totalAmount += charges.totalCharge;
    }

    // 合計金額を更新
    await pool.query(
      'UPDATE applications SET total_amount = ? WHERE id = ?',
      [totalAmount, applicationId]
    );

    await this.logActivity(
      staffId,
      'update',
      'application',
      applicationId,
      `Total amount recalculated: ${totalAmount}`
    );

    return totalAmount;
  }

  /**
   * 本日の利用一覧を取得
   */
  async getTodayUsages(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         r.name as room_name,
         a.event_name,
         a.applicant_representative,
         a.cancel_status
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       JOIN applications a ON u.application_id = a.id
       WHERE u.date = CURDATE()
       ORDER BY
         u.use_morning DESC,
         u.use_afternoon DESC,
         u.use_evening DESC,
         r.name`
    );

    return rows;
  }

  /**
   * 期間内の利用一覧を取得
   */
  async getUsagesByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         r.name as room_name,
         a.event_name,
         a.applicant_representative,
         a.cancel_status,
         a.payment_status
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       JOIN applications a ON u.application_id = a.id
       WHERE u.date >= ? AND u.date <= ?
       ORDER BY u.date, r.name`,
      [startDate, endDate]
    );

    return rows;
  }

  /**
   * エアコン未入力の利用記録を取得
   */
  async getUsagesWithMissingAcHours(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         r.name as room_name,
         a.event_name,
         a.applicant_representative
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       JOIN applications a ON u.application_id = a.id
       WHERE u.ac_requested = TRUE
         AND u.ac_hours IS NULL
         AND u.date < CURDATE()
         AND a.cancel_status = 'none'
       ORDER BY u.date DESC
       LIMIT 50`
    );

    return rows;
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
}

export default new StaffUsageManagementService();

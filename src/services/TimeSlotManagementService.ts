import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { TimeSlot, RoomTimeSlotPrice } from '../models/types';

export interface CreateTimeSlotDto {
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  slot_type: 'regular' | 'extension' | 'flexible';
  display_order?: number;
  description?: string;
}

/**
 * 時間帯管理サービス
 */
export class TimeSlotManagementService {
  /**
   * 時間帯一覧を取得
   */
  async getTimeSlots(includeInactive: boolean = false): Promise<TimeSlot[]> {
    let query = 'SELECT * FROM time_slots';

    if (!includeInactive) {
      query += ' WHERE is_active = TRUE';
    }

    query += ' ORDER BY display_order, start_time';

    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows as TimeSlot[];
  }

  /**
   * 時間帯を作成
   */
  async createTimeSlot(staffId: number, data: CreateTimeSlotDto): Promise<TimeSlot> {
    // コードの重複チェック
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM time_slots WHERE code = ?',
      [data.code]
    );

    if (existing.length > 0) {
      throw new Error('Time slot code already exists');
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO time_slots (name, code, start_time, end_time, duration_minutes, slot_type, display_order, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.code,
        data.start_time,
        data.end_time,
        data.duration_minutes,
        data.slot_type,
        data.display_order || 0,
        data.description || null,
      ]
    );

    const [timeSlot] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM time_slots WHERE id = ?',
      [result.insertId]
    );

    await this.logActivity(staffId, 'create', 'time_slot', result.insertId, `Time slot created: ${data.name}`);

    return timeSlot[0] as TimeSlot;
  }

  /**
   * 時間帯を更新
   */
  async updateTimeSlot(timeSlotId: number, staffId: number, updates: Partial<TimeSlot>): Promise<void> {
    const [timeSlot] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM time_slots WHERE id = ?',
      [timeSlotId]
    );

    if (timeSlot.length === 0) {
      throw new Error('Time slot not found');
    }

    const fields = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => updates[key as keyof TimeSlot]);

    if (fields) {
      await pool.query(
        `UPDATE time_slots SET ${fields} WHERE id = ?`,
        [...values, timeSlotId]
      );
    }

    await this.logActivity(staffId, 'update', 'time_slot', timeSlotId, `Time slot updated: ${JSON.stringify(updates)}`);
  }

  /**
   * 時間帯を削除（論理削除）
   */
  async deleteTimeSlot(timeSlotId: number, staffId: number): Promise<void> {
    // 使用されているかチェック
    const [usage] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM room_time_slot_prices WHERE time_slot_id = ?',
      [timeSlotId]
    );

    if (usage[0].count > 0) {
      // 使用されている場合は論理削除
      await pool.query(
        'UPDATE time_slots SET is_active = FALSE WHERE id = ?',
        [timeSlotId]
      );
    } else {
      // 使用されていない場合は物理削除
      await pool.query('DELETE FROM time_slots WHERE id = ?', [timeSlotId]);
    }

    await this.logActivity(staffId, 'delete', 'time_slot', timeSlotId, 'Time slot deleted');
  }

  /**
   * 部屋の時間帯別料金を設定
   */
  async setRoomTimeSlotPrices(
    roomId: number,
    timeSlotId: number,
    staffId: number,
    basePrice: number,
    acPricePerHour: number,
    isAvailable: boolean = true
  ): Promise<void> {
    await pool.query(
      `INSERT INTO room_time_slot_prices (room_id, time_slot_id, base_price, ac_price_per_hour, is_available)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE base_price = ?, ac_price_per_hour = ?, is_available = ?`,
      [roomId, timeSlotId, basePrice, acPricePerHour, isAvailable, basePrice, acPricePerHour, isAvailable]
    );

    await this.logActivity(
      staffId,
      'update',
      'room_time_slot_price',
      roomId,
      `Room ${roomId} time slot ${timeSlotId} price set: ${basePrice}`
    );
  }

  /**
   * 部屋の時間帯別料金を取得
   */
  async getRoomTimeSlotPrices(roomId: number): Promise<RoomTimeSlotPrice[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rtsp.*, ts.name as time_slot_name, ts.start_time, ts.end_time
       FROM room_time_slot_prices rtsp
       JOIN time_slots ts ON rtsp.time_slot_id = ts.id
       WHERE rtsp.room_id = ?
       ORDER BY ts.display_order`,
      [roomId]
    );

    return rows as any[];
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

export default new TimeSlotManagementService();

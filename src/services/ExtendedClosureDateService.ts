import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { RoomClosedDate } from '../models/types';

export interface CreateRoomClosedDateDto {
  room_id: number;
  date: Date;
  reason: string;
  closed_time_slots?: number[] | null; // null = 終日休館
}

/**
 * 拡張された休館日管理サービス
 */
export class ExtendedClosureDateService {
  /**
   * 部屋別休館日を追加
   */
  async addRoomClosedDate(staffId: number, data: CreateRoomClosedDateDto): Promise<void> {
    // 既存の予約がある場合は警告
    const [usages] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM usages u
       JOIN applications a ON u.application_id = a.id
       WHERE u.room_id = ?
         AND u.date = ?
         AND a.cancel_status = 'none'`,
      [data.room_id, data.date]
    );

    if (usages[0].count > 0) {
      throw new Error(`There are ${usages[0].count} existing reservations for this room on this date`);
    }

    await pool.query(
      `INSERT INTO room_closed_dates (room_id, date, reason, closed_time_slots, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = ?, closed_time_slots = ?`,
      [
        data.room_id,
        data.date,
        data.reason,
        data.closed_time_slots ? JSON.stringify(data.closed_time_slots) : null,
        staffId,
        data.reason,
        data.closed_time_slots ? JSON.stringify(data.closed_time_slots) : null,
      ]
    );

    await this.logActivity(
      staffId,
      'create',
      'room_closed_date',
      data.room_id,
      `Room ${data.room_id} closed on ${data.date}: ${data.reason}`
    );
  }

  /**
   * 部屋別休館日を取得
   */
  async getRoomClosedDates(roomId?: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = `
      SELECT
        rcd.*,
        r.name as room_name,
        u.name as created_by_name
      FROM room_closed_dates rcd
      JOIN rooms r ON rcd.room_id = r.id
      JOIN users u ON rcd.created_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (roomId) {
      query += ' AND rcd.room_id = ?';
      params.push(roomId);
    }

    if (startDate) {
      query += ' AND rcd.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND rcd.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY rcd.date DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // JSON パースを行う
    return rows.map(row => ({
      ...row,
      closed_time_slots: row.closed_time_slots ? JSON.parse(row.closed_time_slots) : null,
    }));
  }

  /**
   * 部屋別休館日を削除
   */
  async deleteRoomClosedDate(roomClosedDateId: number, staffId: number): Promise<void> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM room_closed_dates WHERE id = ?',
      [roomClosedDateId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Room closed date not found');
    }

    await this.logActivity(
      staffId,
      'delete',
      'room_closed_date',
      roomClosedDateId,
      'Room closed date removed'
    );
  }

  /**
   * 全館休館日を追加（既存のclosed_datesテーブル拡張）
   */
  async addGlobalClosedDate(
    staffId: number,
    date: Date,
    reason: string,
    closureType: 'full' | 'partial' | 'year_end' = 'full',
    affectedRooms?: number[]
  ): Promise<void> {
    // 既存の予約がある場合は警告
    let checkQuery = `
      SELECT COUNT(*) as count
      FROM usages u
      JOIN applications a ON u.application_id = a.id
      WHERE u.date = ?
        AND a.cancel_status = 'none'
    `;

    const checkParams: any[] = [date];

    if (closureType === 'partial' && affectedRooms && affectedRooms.length > 0) {
      checkQuery += ' AND u.room_id IN (?)';
      checkParams.push(affectedRooms);
    }

    const [usages] = await pool.query<RowDataPacket[]>(checkQuery, checkParams);

    if (usages[0].count > 0) {
      throw new Error(`There are ${usages[0].count} existing reservations on this date`);
    }

    await pool.query(
      `INSERT INTO closed_dates (date, reason, closure_type, affected_rooms)
       VALUES (?, ?, ?, ?)`,
      [date, reason, closureType, affectedRooms ? JSON.stringify(affectedRooms) : null]
    );

    await this.logActivity(
      staffId,
      'create',
      'closed_date',
      0,
      `Global closed date added: ${date} (${closureType}) - ${reason}`
    );
  }

  /**
   * 特定日に部屋が利用可能かチェック
   */
  async isRoomAvailable(roomId: number, date: Date, timeSlotIds?: number[]): Promise<boolean> {
    // 全館休館日チェック
    const [globalClosed] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM closed_dates
       WHERE date = ?
         AND (closure_type = 'full'
              OR (closure_type = 'partial' AND JSON_CONTAINS(affected_rooms, ?)))`,
      [date, JSON.stringify(roomId)]
    );

    if (globalClosed.length > 0) {
      return false;
    }

    // 部屋別休館日チェック
    const [roomClosed] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM room_closed_dates WHERE room_id = ? AND date = ?',
      [roomId, date]
    );

    if (roomClosed.length === 0) {
      return true; // 休館日設定なし
    }

    const closedRecord = roomClosed[0];

    // 終日休館
    if (!closedRecord.closed_time_slots) {
      return false;
    }

    // 特定時間帯のみ休館
    if (timeSlotIds && timeSlotIds.length > 0) {
      const closedSlots = JSON.parse(closedRecord.closed_time_slots);
      const hasConflict = timeSlotIds.some(slotId => closedSlots.includes(slotId));
      return !hasConflict;
    }

    return true;
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

export default new ExtendedClosureDateService();

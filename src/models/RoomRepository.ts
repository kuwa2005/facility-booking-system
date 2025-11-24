import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { Room } from './types';

export class RoomRepository {
  /**
   * Convert snake_case database columns to camelCase
   */
  private toCamelCase(room: any): any {
    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      basePriceMorning: room.base_price_morning,
      basePriceAfternoon: room.base_price_afternoon,
      basePriceEvening: room.base_price_evening,
      extensionPriceMidday: room.extension_price_midday,
      extensionPriceEvening: room.extension_price_evening,
      weekendPriceMorning: room.weekend_price_morning,
      weekendPriceAfternoon: room.weekend_price_afternoon,
      weekendPriceEvening: room.weekend_price_evening,
      weekendExtensionPriceMidday: room.weekend_extension_price_midday,
      weekendExtensionPriceEvening: room.weekend_extension_price_evening,
      acPricePerHour: room.ac_price_per_hour,
      description: room.description,
      isActive: room.is_active,
      maxReservationCount: room.max_reservation_count,
      isFlexibleTime: room.is_flexible_time,
      minDurationMinutes: room.min_duration_minutes,
      timeUnitMinutes: room.time_unit_minutes,
      pricePerUnit: room.price_per_unit,
      displayOrder: room.display_order,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  }

  /**
   * Find room by ID
   */
  async findById(id: number): Promise<any> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE id = ?',
      [id]
    );
    return rows[0] ? this.toCamelCase(rows[0]) : null;
  }

  /**
   * Find all active rooms
   */
  async findAllActive(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE is_active = TRUE ORDER BY display_order ASC, name ASC'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Find all rooms (including inactive)
   */
  async findAll(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms ORDER BY display_order ASC, name ASC'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Create a new room
   */
  async create(data: any): Promise<any> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rooms (
        name, capacity, base_price_morning, base_price_afternoon, base_price_evening,
        extension_price_midday, extension_price_evening,
        weekend_price_morning, weekend_price_afternoon, weekend_price_evening,
        weekend_extension_price_midday, weekend_extension_price_evening,
        ac_price_per_hour, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.capacity || null,
        data.basePriceMorning || data.base_price_morning,
        data.basePriceAfternoon || data.base_price_afternoon,
        data.basePriceEvening || data.base_price_evening,
        data.extensionPriceMidday || data.extension_price_midday,
        data.extensionPriceEvening || data.extension_price_evening,
        data.weekendPriceMorning || data.weekend_price_morning || null,
        data.weekendPriceAfternoon || data.weekend_price_afternoon || null,
        data.weekendPriceEvening || data.weekend_price_evening || null,
        data.weekendExtensionPriceMidday || data.weekend_extension_price_midday || null,
        data.weekendExtensionPriceEvening || data.weekend_extension_price_evening || null,
        data.acPricePerHour || data.ac_price_per_hour,
        data.description || null,
        data.isActive !== false && data.is_active !== false,
      ]
    );

    const room = await this.findById(result.insertId);
    if (!room) {
      throw new Error('Failed to create room');
    }
    return room;
  }

  /**
   * Update room
   */
  async update(id: number, data: any): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];

    // Convert camelCase to snake_case
    const fieldMap: { [key: string]: string } = {
      name: 'name',
      capacity: 'capacity',
      basePriceMorning: 'base_price_morning',
      basePriceAfternoon: 'base_price_afternoon',
      basePriceEvening: 'base_price_evening',
      extensionPriceMidday: 'extension_price_midday',
      extensionPriceEvening: 'extension_price_evening',
      weekendPriceMorning: 'weekend_price_morning',
      weekendPriceAfternoon: 'weekend_price_afternoon',
      weekendPriceEvening: 'weekend_price_evening',
      weekendExtensionPriceMidday: 'weekend_extension_price_midday',
      weekendExtensionPriceEvening: 'weekend_extension_price_evening',
      acPricePerHour: 'ac_price_per_hour',
      description: 'description',
      isActive: 'is_active',
      maxReservationCount: 'max_reservation_count',
      isFlexibleTime: 'is_flexible_time',
      minDurationMinutes: 'min_duration_minutes',
      timeUnitMinutes: 'time_unit_minutes',
      pricePerUnit: 'price_per_unit',
      displayOrder: 'display_order',
      updatedAt: 'updated_at',
    };

    Object.entries(data).forEach(([key, value]) => {
      const dbField = fieldMap[key] || key;
      if (dbField !== 'id' && dbField !== 'created_at') {
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      const room = await this.findById(id);
      if (!room) throw new Error('Room not found');
      return room;
    }

    values.push(id);
    await pool.query(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`, values);

    const room = await this.findById(id);
    if (!room) {
      throw new Error('Room not found');
    }
    return room;
  }

  /**
   * Delete room (soft delete by setting is_active to false)
   */
  async softDelete(id: number): Promise<void> {
    await pool.query('UPDATE rooms SET is_active = FALSE WHERE id = ?', [id]);
  }

  /**
   * Restore room (reactivate by setting is_active to true)
   */
  async restore(id: number): Promise<void> {
    await pool.query('UPDATE rooms SET is_active = TRUE WHERE id = ?', [id]);
  }

  /**
   * Permanently delete room (physical delete)
   * This will cascade delete all related data
   */
  async permanentDelete(id: number): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Delete related usage equipment first
      await connection.query(
        `DELETE ue FROM usage_equipment ue
         INNER JOIN usages u ON ue.usage_id = u.id
         WHERE u.room_id = ?`,
        [id]
      );

      // Delete related usages
      await connection.query('DELETE FROM usages WHERE room_id = ?', [id]);

      // Delete room equipment associations
      await connection.query('DELETE FROM room_equipment WHERE room_id = ?', [id]);

      // Delete room closed dates
      await connection.query('DELETE FROM room_closed_dates WHERE room_id = ?', [id]);

      // Delete room timeslot prices
      await connection.query('DELETE FROM room_timeslot_prices WHERE room_id = ?', [id]);

      // Finally delete the room itself
      await connection.query('DELETE FROM rooms WHERE id = ?', [id]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if room has any existing reservations
   */
  async hasReservations(roomId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM usages WHERE room_id = ?',
      [roomId]
    );
    return Number(rows[0]?.count || 0) > 0;
  }

  /**
   * Update display order for multiple rooms
   */
  async updateBulkDisplayOrder(orderUpdates: { id: number; displayOrder: number }[]): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const update of orderUpdates) {
        await connection.query(
          'UPDATE rooms SET display_order = ? WHERE id = ?',
          [update.displayOrder, update.id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if room has available inventory for the specified date and time slots
   * @param roomId 部屋ID
   * @param date 予約日
   * @param useMorning 午前使用フラグ
   * @param useAfternoon 午後使用フラグ
   * @param useEvening 夜間使用フラグ
   * @param excludeApplicationId 除外する予約ID（編集時に自分の予約を除外）
   * @returns 予約可能な場合true、満室の場合false
   */
  async checkAvailability(
    roomId: number,
    date: string,
    useMorning: boolean,
    useAfternoon: boolean,
    useEvening: boolean,
    excludeApplicationId?: number
  ): Promise<boolean> {
    // 部屋情報を取得（max_reservation_countを取得）
    const room = await this.findById(roomId);
    if (!room || !room.isActive) {
      return false;
    }

    const maxCount = room.maxReservationCount || 1;

    // 各時間帯について予約数をチェック
    const timeslots = [
      { name: 'morning', use: useMorning },
      { name: 'afternoon', use: useAfternoon },
      { name: 'evening', use: useEvening }
    ];

    for (const slot of timeslots) {
      if (!slot.use) continue;

      // この時間帯の予約数をカウント
      const countQuery = `
        SELECT COUNT(DISTINCT u.application_id) as count
        FROM usages u
        INNER JOIN applications a ON u.application_id = a.id
        WHERE u.room_id = ?
          AND u.date = ?
          AND u.use_${slot.name} = TRUE
          AND a.cancel_status = 'none'
          ${excludeApplicationId ? 'AND u.application_id != ?' : ''}
      `;

      const params = excludeApplicationId
        ? [roomId, date, excludeApplicationId]
        : [roomId, date];

      const [rows] = await pool.query<RowDataPacket[]>(countQuery, params);
      const currentCount = Number(rows[0]?.count || 0);

      // 予約数が最大数に達している場合は予約不可
      if (currentCount >= maxCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get available count for specific date and time slots
   * @param roomId 部屋ID
   * @param date 予約日
   * @param useMorning 午前使用フラグ
   * @param useAfternoon 午後使用フラグ
   * @param useEvening 夜間使用フラグ
   * @returns { available: number, max: number } 残り予約可能数と最大数
   */
  async getAvailableCount(
    roomId: number,
    date: string,
    useMorning: boolean,
    useAfternoon: boolean,
    useEvening: boolean
  ): Promise<{ available: number; max: number }> {
    const room = await this.findById(roomId);
    if (!room || !room.isActive) {
      return { available: 0, max: 0 };
    }

    const maxCount = room.maxReservationCount || 1;
    let minAvailable = maxCount;

    // 各時間帯について予約数をチェックし、最も少ない残数を返す
    const timeslots = [
      { name: 'morning', use: useMorning },
      { name: 'afternoon', use: useAfternoon },
      { name: 'evening', use: useEvening }
    ];

    for (const slot of timeslots) {
      if (!slot.use) continue;

      const countQuery = `
        SELECT COUNT(DISTINCT u.application_id) as count
        FROM usages u
        INNER JOIN applications a ON u.application_id = a.id
        WHERE u.room_id = ?
          AND u.date = ?
          AND u.use_${slot.name} = TRUE
          AND a.cancel_status = 'none'
      `;

      const [rows] = await pool.query<RowDataPacket[]>(countQuery, [roomId, date]);
      const currentCount = Number(rows[0]?.count || 0);
      const available = maxCount - currentCount;

      if (available < minAvailable) {
        minAvailable = available;
      }
    }

    return { available: minAvailable, max: maxCount };
  }
}

export default new RoomRepository();

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
      acPricePerHour: room.ac_price_per_hour,
      description: room.description,
      isActive: room.is_active,
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
        extension_price_midday, extension_price_evening, ac_price_per_hour,
        description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.capacity || null,
        data.basePriceMorning || data.base_price_morning,
        data.basePriceAfternoon || data.base_price_afternoon,
        data.basePriceEvening || data.base_price_evening,
        data.extensionPriceMidday || data.extension_price_midday,
        data.extensionPriceEvening || data.extension_price_evening,
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
      acPricePerHour: 'ac_price_per_hour',
      description: 'description',
      isActive: 'is_active',
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
   * Check if room has any existing reservations
   */
  async hasReservations(roomId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM usages WHERE room_id = ?',
      [roomId]
    );
    return rows[0].count > 0;
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
}

export default new RoomRepository();

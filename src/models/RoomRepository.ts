import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { Room } from './types';

export class RoomRepository {
  /**
   * Find room by ID
   */
  async findById(id: number): Promise<Room | null> {
    const [rows] = await pool.query<(Room & RowDataPacket)[]>(
      'SELECT * FROM rooms WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all active rooms
   */
  async findAllActive(): Promise<Room[]> {
    const [rows] = await pool.query<(Room & RowDataPacket)[]>(
      'SELECT * FROM rooms WHERE is_active = TRUE ORDER BY name ASC'
    );
    return rows;
  }

  /**
   * Find all rooms (including inactive)
   */
  async findAll(): Promise<Room[]> {
    const [rows] = await pool.query<(Room & RowDataPacket)[]>(
      'SELECT * FROM rooms ORDER BY name ASC'
    );
    return rows;
  }

  /**
   * Create a new room
   */
  async create(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rooms (
        name, capacity, base_price_morning, base_price_afternoon, base_price_evening,
        extension_price_midday, extension_price_evening, ac_price_per_hour,
        description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.capacity || null,
        data.base_price_morning,
        data.base_price_afternoon,
        data.base_price_evening,
        data.extension_price_midday,
        data.extension_price_evening,
        data.ac_price_per_hour,
        data.description || null,
        data.is_active !== false,
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
  async update(id: number, data: Partial<Room>): Promise<Room> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
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
   * Check if room has any existing reservations
   */
  async hasReservations(roomId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM usages WHERE room_id = ?',
      [roomId]
    );
    return rows[0].count > 0;
  }
}

export default new RoomRepository();

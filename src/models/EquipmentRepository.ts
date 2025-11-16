import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { Equipment } from './types';

export class EquipmentRepository {
  /**
   * Find equipment by ID
   */
  async findById(id: number): Promise<Equipment | null> {
    const [rows] = await pool.query<(Equipment & RowDataPacket)[]>(
      'SELECT * FROM equipment WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all enabled equipment
   */
  async findAllEnabled(): Promise<Equipment[]> {
    const [rows] = await pool.query<(Equipment & RowDataPacket)[]>(
      'SELECT * FROM equipment WHERE enabled = TRUE ORDER BY category, name ASC'
    );
    return rows;
  }

  /**
   * Find all equipment (including disabled)
   */
  async findAll(): Promise<Equipment[]> {
    const [rows] = await pool.query<(Equipment & RowDataPacket)[]>(
      'SELECT * FROM equipment ORDER BY category, name ASC'
    );
    return rows;
  }

  /**
   * Find equipment by category
   */
  async findByCategory(category: 'stage' | 'lighting' | 'sound' | 'other'): Promise<Equipment[]> {
    const [rows] = await pool.query<(Equipment & RowDataPacket)[]>(
      'SELECT * FROM equipment WHERE category = ? AND enabled = TRUE ORDER BY name ASC',
      [category]
    );
    return rows;
  }

  /**
   * Find multiple equipment by IDs
   */
  async findByIds(ids: number[]): Promise<Equipment[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query<(Equipment & RowDataPacket)[]>(
      `SELECT * FROM equipment WHERE id IN (${placeholders})`,
      ids
    );
    return rows;
  }

  /**
   * Create new equipment
   */
  async create(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO equipment (
        category, name, price_type, unit_price, max_quantity, enabled, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category,
        data.name,
        data.price_type,
        data.unit_price,
        data.max_quantity,
        data.enabled !== false,
        data.remark || null,
      ]
    );

    const equipment = await this.findById(result.insertId);
    if (!equipment) {
      throw new Error('Failed to create equipment');
    }
    return equipment;
  }

  /**
   * Update equipment
   */
  async update(id: number, data: Partial<Equipment>): Promise<Equipment> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      const equipment = await this.findById(id);
      if (!equipment) throw new Error('Equipment not found');
      return equipment;
    }

    values.push(id);
    await pool.query(`UPDATE equipment SET ${fields.join(', ')} WHERE id = ?`, values);

    const equipment = await this.findById(id);
    if (!equipment) {
      throw new Error('Equipment not found');
    }
    return equipment;
  }

  /**
   * Delete equipment (soft delete by setting enabled to false)
   */
  async softDelete(id: number): Promise<void> {
    await pool.query('UPDATE equipment SET enabled = FALSE WHERE id = ?', [id]);
  }
}

export default new EquipmentRepository();

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { Equipment } from './types';

export class EquipmentRepository {
  /**
   * Convert snake_case database columns to camelCase
   */
  private toCamelCase(equipment: any): Equipment {
    return {
      id: equipment.id,
      category: equipment.category,
      name: equipment.name,
      priceType: equipment.price_type,
      unitPrice: equipment.unit_price,
      maxQuantity: equipment.max_quantity,
      enabled: equipment.enabled,
      remark: equipment.remark,
      createdAt: equipment.created_at,
      updatedAt: equipment.updated_at,
    } as Equipment;
  }

  /**
   * Find equipment by ID
   */
  async findById(id: number): Promise<Equipment | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM equipment WHERE id = ?',
      [id]
    );
    return rows[0] ? this.toCamelCase(rows[0]) : null;
  }

  /**
   * Find all enabled equipment
   */
  async findAllEnabled(): Promise<Equipment[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM equipment WHERE enabled = TRUE ORDER BY category, name ASC'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Find all equipment (including disabled)
   */
  async findAll(): Promise<Equipment[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM equipment ORDER BY category, name ASC'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Find equipment by category
   */
  async findByCategory(category: 'stage' | 'lighting' | 'sound' | 'other'): Promise<Equipment[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM equipment WHERE category = ? AND enabled = TRUE ORDER BY name ASC',
      [category]
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Find multiple equipment by IDs
   */
  async findByIds(ids: number[]): Promise<Equipment[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM equipment WHERE id IN (${placeholders})`,
      ids
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Create new equipment
   */
  async create(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
    // Support both camelCase and snake_case input
    const priceType = (data as any).priceType || (data as any).price_type;
    const unitPrice = (data as any).unitPrice || (data as any).unit_price;
    const maxQuantity = (data as any).maxQuantity || (data as any).max_quantity;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO equipment (
        category, name, price_type, unit_price, max_quantity, enabled, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category,
        data.name,
        priceType,
        unitPrice,
        maxQuantity,
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

    // Map camelCase to snake_case for database columns
    const columnMapping: { [key: string]: string } = {
      priceType: 'price_type',
      unitPrice: 'unit_price',
      maxQuantity: 'max_quantity',
      updatedAt: 'updated_at',
    };

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'created_at') {
        const dbColumn = columnMapping[key] || key;
        fields.push(`${dbColumn} = ?`);
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

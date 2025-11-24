import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Holiday } from './types';

/**
 * 祝日リポジトリ
 */
class HolidayRepository {
  /**
   * snake_case から camelCase に変換
   */
  private toCamelCase(row: any): Holiday {
    return {
      id: row.id,
      date: row.date,
      name: row.name,
      isRecurring: Boolean(row.is_recurring),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * すべての祝日を取得
   */
  async findAll(): Promise<Holiday[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM holidays ORDER BY date ASC'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * 年度別に祝日を取得
   */
  async findByYear(year: number): Promise<Holiday[]> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC',
      [startDate, endDate]
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * IDで祝日を取得
   */
  async findById(id: number): Promise<Holiday | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM holidays WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toCamelCase(rows[0]);
  }

  /**
   * 日付で祝日を検索
   */
  async findByDate(date: string): Promise<Holiday | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM holidays WHERE date = ?',
      [date]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toCamelCase(rows[0]);
  }

  /**
   * 祝日を作成
   */
  async create(data: {
    date: string;
    name: string;
    isRecurring?: boolean;
  }): Promise<Holiday> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO holidays (date, name, is_recurring) VALUES (?, ?, ?)',
      [data.date, data.name, data.isRecurring || false]
    );

    const holiday = await this.findById(result.insertId);
    if (!holiday) {
      throw new Error('Failed to create holiday');
    }

    return holiday;
  }

  /**
   * 祝日を更新
   */
  async update(
    id: number,
    data: {
      date?: string;
      name?: string;
      isRecurring?: boolean;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.isRecurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(data.isRecurring);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(id);

    await pool.query(
      `UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * 祝日を削除
   */
  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM holidays WHERE id = ?', [id]);
  }

  /**
   * 日付が祝日かどうかを判定
   */
  async isHoliday(date: string): Promise<boolean> {
    const holiday = await this.findByDate(date);
    return holiday !== null;
  }

  /**
   * 複数の日付が祝日かどうかを判定
   */
  async checkHolidays(dates: string[]): Promise<Map<string, boolean>> {
    if (dates.length === 0) {
      return new Map();
    }

    const placeholders = dates.map(() => '?').join(',');
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT date FROM holidays WHERE date IN (${placeholders})`,
      dates
    );

    const holidaySet = new Set(rows.map(row => row.date));
    const result = new Map<string, boolean>();

    for (const date of dates) {
      result.set(date, holidaySet.has(date));
    }

    return result;
  }
}

export default new HolidayRepository();

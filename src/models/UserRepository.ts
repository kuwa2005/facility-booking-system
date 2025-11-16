import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { User, CreateUserDto } from './types';

export class UserRepository {
  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query<(User & RowDataPacket)[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query<(User & RowDataPacket)[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Find user by verification code
   */
  async findByVerificationCode(code: string): Promise<User | null> {
    const [rows] = await pool.query<(User & RowDataPacket)[]>(
      'SELECT * FROM users WHERE verification_code = ? AND verification_code_expires_at > NOW()',
      [code]
    );
    return rows[0] || null;
  }

  /**
   * Find user by password reset token
   */
  async findByResetToken(token: string): Promise<User | null> {
    const [rows] = await pool.query<(User & RowDataPacket)[]>(
      'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires_at > NOW()',
      [token]
    );
    return rows[0] || null;
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserDto & { password_hash: string }): Promise<User> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (
        email, password_hash, name, organization_name, phone, address, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.email,
        data.password_hash,
        data.name,
        data.organization_name || null,
        data.phone,
        data.address || null,
        true,
      ]
    );

    const user = await this.findById(result.insertId);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  /**
   * Update user
   */
  async update(id: number, data: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      const user = await this.findById(id);
      if (!user) throw new Error('User not found');
      return user;
    }

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Set verification code for email verification
   */
  async setVerificationCode(userId: number, code: string, expiresInMinutes: number = 15): Promise<void> {
    await pool.query(
      `UPDATE users SET
        verification_code = ?,
        verification_code_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE id = ?`,
      [code, expiresInMinutes, userId]
    );
  }

  /**
   * Mark email as verified
   */
  async markEmailVerified(userId: number): Promise<void> {
    await pool.query(
      `UPDATE users SET
        email_verified = TRUE,
        verification_code = NULL,
        verification_code_expires_at = NULL
      WHERE id = ?`,
      [userId]
    );
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(userId: number, token: string, expiresInMinutes: number = 60): Promise<void> {
    await pool.query(
      `UPDATE users SET
        password_reset_token = ?,
        password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE id = ?`,
      [token, expiresInMinutes, userId]
    );
  }

  /**
   * Reset password
   */
  async resetPassword(userId: number, newPasswordHash: string): Promise<void> {
    await pool.query(
      `UPDATE users SET
        password_hash = ?,
        password_reset_token = NULL,
        password_reset_expires_at = NULL
      WHERE id = ?`,
      [newPasswordHash, userId]
    );
  }

  /**
   * Delete user (soft delete by setting is_active to false)
   */
  async softDelete(id: number): Promise<void> {
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
  }

  /**
   * Find all admin users
   */
  async findAdmins(): Promise<User[]> {
    const [rows] = await pool.query<(User & RowDataPacket)[]>(
      'SELECT * FROM users WHERE is_admin = TRUE AND is_active = TRUE'
    );
    return rows;
  }
}

export default new UserRepository();

import pool from '../config/database';
import { Review, CreateReviewDto, UpdateReviewDto } from './types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Review repository for database operations
 */
class ReviewRepository {
  /**
   * Find review by ID
   */
  async findById(id: number): Promise<Review | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM reviews WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Review) : null;
  }

  /**
   * Find all reviews for a room
   */
  async findByRoomId(roomId: number, limit: number = 50, offset: number = 0): Promise<Review[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM reviews WHERE room_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [roomId, limit, offset]
    );
    return rows as Review[];
  }

  /**
   * Find all reviews by a user
   */
  async findByUserId(userId: number): Promise<Review[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows as Review[];
  }

  /**
   * Find review by application ID
   */
  async findByApplicationId(applicationId: number): Promise<Review | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM reviews WHERE application_id = ?',
      [applicationId]
    );
    return rows.length > 0 ? (rows[0] as Review) : null;
  }

  /**
   * Get reviews for a room with user information
   */
  async findByRoomIdWithUser(
    roomId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<Review & { user_name: string; user_nickname: string | null }>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, u.name as user_name, u.nickname as user_nickname
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.room_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );
    return rows as Array<Review & { user_name: string; user_nickname: string | null }>;
  }

  /**
   * Get average rating for a room
   */
  async getAverageRating(roomId: number): Promise<{ average: number; count: number }> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT AVG(rating) as average, COUNT(*) as count FROM reviews WHERE room_id = ?',
      [roomId]
    );
    return {
      average: rows[0]?.average || 0,
      count: rows[0]?.count || 0,
    };
  }

  /**
   * Get rating distribution for a room
   */
  async getRatingDistribution(roomId: number): Promise<Record<number, number>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rating, COUNT(*) as count
       FROM reviews
       WHERE room_id = ?
       GROUP BY rating
       ORDER BY rating DESC`,
      [roomId]
    );

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    rows.forEach((row: any) => {
      distribution[row.rating] = row.count;
    });
    return distribution;
  }

  /**
   * Create a new review
   */
  async create(userId: number, data: CreateReviewDto): Promise<Review> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO reviews (user_id, room_id, application_id, rating, title, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, data.room_id, data.application_id || null, data.rating, data.title, data.comment || null]
    );

    const review = await this.findById(result.insertId);
    if (!review) {
      throw new Error('Failed to create review');
    }
    return review;
  }

  /**
   * Update a review
   */
  async update(id: number, data: UpdateReviewDto): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.rating !== undefined) {
      fields.push('rating = ?');
      values.push(data.rating);
    }
    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.comment !== undefined) {
      fields.push('comment = ?');
      values.push(data.comment);
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);

    await pool.query(
      `UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Delete a review
   */
  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM reviews WHERE id = ?', [id]);
  }

  /**
   * Check if user has already reviewed a room (via application)
   */
  async hasUserReviewedApplication(userId: number, applicationId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM reviews WHERE user_id = ? AND application_id = ?',
      [userId, applicationId]
    );
    return rows[0].count > 0;
  }

  /**
   * Get recent reviews (across all rooms)
   */
  async getRecentReviews(limit: number = 10): Promise<
    Array<
      Review & {
        user_name: string;
        user_nickname: string | null;
        room_name: string;
      }
    >
  > {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, u.name as user_name, u.nickname as user_nickname, rm.name as room_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN rooms rm ON r.room_id = rm.id
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows as Array<Review & { user_name: string; user_nickname: string | null; room_name: string }>;
  }
}

export default new ReviewRepository();

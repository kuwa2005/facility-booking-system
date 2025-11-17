import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { UserNote, CreateUserNoteDto, UserNoteWithStaffDto } from '../models/types';

/**
 * ユーザーメモ管理サービス（管理者専用）
 * - 一般利用者に対する管理者メモ
 * - 「要注意顧客」「鍵をよく返却しないので要注意」「無断キャンセルあり」など
 * - 一般利用者からは見えない（管理者専用）
 */
export class UserNoteService {
  /**
   * ユーザーのメモ一覧取得
   * @param userId ユーザーID
   * @param includeDeleted 削除済みメモも含めるか
   */
  async getUserNotes(
    userId: number,
    includeDeleted: boolean = false,
  ): Promise<UserNoteWithStaffDto[]> {
    let query = `
      SELECT
        un.*,
        s.name as staff_name
      FROM user_notes un
      LEFT JOIN staff s ON un.created_by = s.id
      WHERE un.user_id = ?
    `;

    if (!includeDeleted) {
      query += ` AND un.deleted_at IS NULL`;
    }

    query += ` ORDER BY un.created_at DESC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);
    return rows as UserNoteWithStaffDto[];
  }

  /**
   * メモ詳細取得
   */
  async getNoteById(noteId: number): Promise<UserNote | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM user_notes WHERE id = ? AND deleted_at IS NULL`,
      [noteId],
    );

    if (rows.length === 0) return null;
    return rows[0] as UserNote;
  }

  /**
   * ユーザーメモ追加
   * @param userId 対象ユーザーID
   * @param staffId 作成する職員ID
   * @param data メモ内容
   */
  async addUserNote(
    userId: number,
    staffId: number,
    data: CreateUserNoteDto,
  ): Promise<UserNote> {
    const { note_content, note_category = null } = data;

    // ユーザーが存在するか確認
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`,
      [userId],
    );

    if (userRows.length === 0) {
      throw new Error('User not found');
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_notes (user_id, note_content, note_category, created_by)
       VALUES (?, ?, ?, ?)`,
      [userId, note_content, note_category, staffId],
    );

    const noteId = result.insertId;

    // 活動ログ記録
    await pool.query(
      `INSERT INTO activity_logs (staff_id, action_type, entity_type, entity_id, description)
       VALUES (?, 'create', 'user_note', ?, ?)`,
      [
        staffId,
        noteId,
        `ユーザー（ID: ${userId}）にメモを追加しました`,
      ],
    );

    const newNote = await this.getNoteById(noteId);
    if (!newNote) {
      throw new Error('Failed to retrieve created note');
    }

    return newNote;
  }

  /**
   * ユーザーメモ更新
   */
  async updateUserNote(
    noteId: number,
    staffId: number,
    updates: Partial<CreateUserNoteDto>,
  ): Promise<void> {
    const note = await this.getNoteById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.note_content !== undefined) {
      fields.push('note_content = ?');
      values.push(updates.note_content);
    }
    if (updates.note_category !== undefined) {
      fields.push('note_category = ?');
      values.push(updates.note_category);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(noteId);

    await pool.query(
      `UPDATE user_notes SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );

    // 活動ログ記録
    await pool.query(
      `INSERT INTO activity_logs (staff_id, action_type, entity_type, entity_id, description)
       VALUES (?, 'update', 'user_note', ?, ?)`,
      [staffId, noteId, `ユーザーメモ（ID: ${noteId}）を更新しました`],
    );
  }

  /**
   * ユーザーメモ削除（論理削除）
   */
  async deleteUserNote(noteId: number, staffId: number): Promise<void> {
    const note = await this.getNoteById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    await pool.query(
      `UPDATE user_notes SET deleted_at = NOW() WHERE id = ?`,
      [noteId],
    );

    // 活動ログ記録
    await pool.query(
      `INSERT INTO activity_logs (staff_id, action_type, entity_type, entity_id, description)
       VALUES (?, 'delete', 'user_note', ?, ?)`,
      [staffId, noteId, `ユーザーメモ（ID: ${noteId}）を削除しました`],
    );
  }

  /**
   * カテゴリ別メモ件数取得
   * @param userId ユーザーID（指定しない場合は全ユーザー）
   */
  async getNoteCountsByCategory(userId?: number): Promise<any[]> {
    let query = `
      SELECT
        note_category,
        COUNT(*) as count
      FROM user_notes
      WHERE deleted_at IS NULL
    `;

    const params: any[] = [];

    if (userId !== undefined) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    query += ` GROUP BY note_category ORDER BY count DESC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows;
  }

  /**
   * 特定カテゴリのメモを持つユーザー一覧取得
   * @param category カテゴリ名
   */
  async getUsersByNoteCategory(category: string): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT
         u.id,
         u.name,
         u.email,
         u.phone,
         COUNT(un.id) as note_count
       FROM user_notes un
       INNER JOIN users u ON un.user_id = u.id
       WHERE un.note_category = ?
         AND un.deleted_at IS NULL
         AND u.deleted_at IS NULL
       GROUP BY u.id, u.name, u.email, u.phone
       ORDER BY note_count DESC`,
      [category],
    );

    return rows;
  }

  /**
   * メモ統計取得
   */
  async getNoteStats(): Promise<any> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_notes,
         COUNT(DISTINCT user_id) as users_with_notes,
         COUNT(DISTINCT created_by) as staff_who_created_notes,
         COUNT(DISTINCT note_category) as unique_categories
       FROM user_notes
       WHERE deleted_at IS NULL`,
    );

    return rows[0];
  }

  /**
   * 最近追加されたメモ取得
   * @param limit 取得件数
   */
  async getRecentNotes(limit: number = 10): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         un.*,
         u.name as user_name,
         u.email as user_email,
         s.name as staff_name
       FROM user_notes un
       INNER JOIN users u ON un.user_id = u.id
       INNER JOIN staff s ON un.created_by = s.id
       WHERE un.deleted_at IS NULL
       ORDER BY un.created_at DESC
       LIMIT ?`,
      [limit],
    );

    return rows;
  }
}

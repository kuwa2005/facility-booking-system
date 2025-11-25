import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import {
  Announcement,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from '../models/types';

/**
 * お知らせ管理サービス
 * - 公開お知らせ（ログイン前に全員向け）
 * - 一般利用者向けお知らせ（ログイン後）
 */
export class AnnouncementService {
  /**
   * 公開お知らせ一覧取得（認証不要）
   * - ログイン前に全員向けに表示
   * - 有効期間内かつis_activeなもののみ
   */
  async getPublicAnnouncements(): Promise<Announcement[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM announcements
       WHERE announcement_type = 'public'
         AND is_active = TRUE
         AND deleted_at IS NULL
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY priority DESC, created_at DESC`,
    );
    return rows as Announcement[];
  }

  /**
   * 一般利用者向けお知らせ一覧取得（認証必要）
   * - ログイン後の一般利用者のみに表示
   * - 有効期間内かつis_activeなもののみ
   */
  async getUserAnnouncements(): Promise<Announcement[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM announcements
       WHERE announcement_type = 'user'
         AND is_active = TRUE
         AND deleted_at IS NULL
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY priority DESC, created_at DESC`,
    );
    return rows as Announcement[];
  }

  /**
   * 職員向け：全お知らせ一覧取得
   * @param includeInactive 無効なお知らせも含めるか
   */
  async getAllAnnouncements(
    includeInactive: boolean = false,
  ): Promise<Announcement[]> {
    let query = `SELECT * FROM announcements WHERE deleted_at IS NULL`;

    if (!includeInactive) {
      query += ` AND is_active = TRUE`;
    }

    query += ` ORDER BY priority DESC, created_at DESC`;

    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows as Announcement[];
  }

  /**
   * お知らせ詳細取得
   */
  async getAnnouncementById(
    announcementId: number,
  ): Promise<Announcement | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM announcements WHERE id = ? AND deleted_at IS NULL`,
      [announcementId],
    );

    if (rows.length === 0) return null;
    return rows[0] as Announcement;
  }

  /**
   * お知らせ作成（職員のみ）
   */
  async createAnnouncement(
    staffId: number,
    data: CreateAnnouncementDto,
  ): Promise<Announcement> {
    const {
      title,
      content,
      announcement_type,
      priority = 0,
      is_active = true,
      starts_at = null,
      ends_at = null,
    } = data;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO announcements
       (title, content, announcement_type, priority, is_active, starts_at, ends_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content,
        announcement_type,
        priority,
        is_active,
        starts_at,
        ends_at,
        staffId,
      ],
    );

    const announcementId = result.insertId;

    // 活動ログ記録
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, 'create', 'announcement', ?, ?)`,
      [staffId, announcementId, `お知らせ「${title}」を作成しました`],
    );

    const newAnnouncement = await this.getAnnouncementById(announcementId);
    if (!newAnnouncement) {
      throw new Error('Failed to retrieve created announcement');
    }

    return newAnnouncement;
  }

  /**
   * お知らせ更新（職員のみ）
   */
  async updateAnnouncement(
    announcementId: number,
    staffId: number,
    updates: UpdateAnnouncementDto,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.announcement_type !== undefined) {
      fields.push('announcement_type = ?');
      values.push(updates.announcement_type);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }
    if (updates.starts_at !== undefined) {
      fields.push('starts_at = ?');
      values.push(updates.starts_at);
    }
    if (updates.ends_at !== undefined) {
      fields.push('ends_at = ?');
      values.push(updates.ends_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(announcementId);

    await pool.query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );

    // 活動ログ記録
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, 'update', 'announcement', ?, ?)`,
      [staffId, announcementId, `お知らせ（ID: ${announcementId}）を更新しました`],
    );
  }

  /**
   * お知らせ削除（職員のみ）
   * - 論理削除
   */
  async deleteAnnouncement(
    announcementId: number,
    staffId: number,
  ): Promise<void> {
    const announcement = await this.getAnnouncementById(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    await pool.query(
      `UPDATE announcements SET deleted_at = NOW() WHERE id = ?`,
      [announcementId],
    );

    // 活動ログ記録
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, 'delete', 'announcement', ?, ?)`,
      [
        staffId,
        announcementId,
        `お知らせ「${announcement.title}」を削除しました`,
      ],
    );
  }

  /**
   * お知らせの有効/無効切り替え
   */
  async toggleAnnouncementStatus(
    announcementId: number,
    staffId: number,
    isActive: boolean,
  ): Promise<void> {
    await pool.query(
      `UPDATE announcements SET is_active = ? WHERE id = ? AND deleted_at IS NULL`,
      [isActive, announcementId],
    );

    // 活動ログ記録
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, 'update', 'announcement', ?, ?)`,
      [
        staffId,
        announcementId,
        `お知らせ（ID: ${announcementId}）を${isActive ? '有効' : '無効'}にしました`,
      ],
    );
  }
}

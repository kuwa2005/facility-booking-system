import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { Message, CreateMessageDto, MessageThreadDto } from '../models/types';

/**
 * メッセージ管理サービス
 * - 一般利用者 ⇔ 職員・管理者のメッセージング
 * - 一般利用者同士のメッセージは不可
 */
export class MessageService {
  /**
   * メッセージ送信（一般利用者から職員へ）
   */
  async sendMessageFromUser(
    userId: number,
    data: CreateMessageDto,
  ): Promise<Message> {
    // 一般利用者から職員へのメッセージのみ許可
    if (data.recipient_type !== 'staff') {
      throw new Error('一般利用者は職員にのみメッセージを送信できます');
    }

    const { recipient_id, subject, content, parent_message_id = null } = data;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO messages
       (sender_type, sender_id, recipient_type, recipient_id, subject, content, parent_message_id)
       VALUES ('user', ?, 'staff', ?, ?, ?, ?)`,
      [userId, recipient_id, subject, content, parent_message_id],
    );

    const messageId = result.insertId;
    const newMessage = await this.getMessageById(messageId);
    if (!newMessage) {
      throw new Error('Failed to retrieve sent message');
    }

    return newMessage;
  }

  /**
   * メッセージ送信（職員から一般利用者へ）
   */
  async sendMessageFromStaff(
    staffId: number,
    data: CreateMessageDto,
  ): Promise<Message> {
    // 職員から一般利用者へのメッセージのみ許可
    if (data.recipient_type !== 'user') {
      throw new Error('職員は一般利用者にのみメッセージを送信できます');
    }

    const {
      recipient_id,
      subject,
      content,
      parent_message_id = null,
      expires_at = null,
    } = data;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO messages
       (sender_type, sender_id, recipient_type, recipient_id, subject, content, parent_message_id, expires_at)
       VALUES ('staff', ?, 'user', ?, ?, ?, ?, ?)`,
      [staffId, recipient_id, subject, content, parent_message_id, expires_at],
    );

    const messageId = result.insertId;

    // 活動ログ記録
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, 'create', 'message', ?, ?)`,
      [staffId, messageId, `ユーザー（ID: ${recipient_id}）にメッセージを送信しました`],
    );

    const newMessage = await this.getMessageById(messageId);
    if (!newMessage) {
      throw new Error('Failed to retrieve sent message');
    }

    return newMessage;
  }

  /**
   * メッセージ詳細取得
   */
  async getMessageById(messageId: number): Promise<Message | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL`,
      [messageId],
    );

    if (rows.length === 0) return null;

    const row: any = rows[0];
    // BigInt を Number に変換
    return {
      ...row,
      id: row.id ? Number(row.id) : row.id,
      sender_id: row.sender_id ? Number(row.sender_id) : row.sender_id,
      recipient_id: row.recipient_id ? Number(row.recipient_id) : row.recipient_id,
      parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : row.parent_message_id,
    } as Message;
  }

  /**
   * ユーザーのメッセージ一覧取得
   * @param userId 一般利用者ID
   * @param includeDeleted 削除済みメッセージも含めるか
   * @param page ページ番号（1から開始、デフォルト: 1）
   * @param limit 1ページあたりの件数（デフォルト: 30）
   */
  async getUserMessages(
    userId: number,
    includeDeleted: boolean = false,
    page: number = 1,
    limit: number = 30,
  ): Promise<Message[]> {
    let query = `
      SELECT m.*,
             sender.name as sender_name, sender.email as sender_email,
             recipient.name as recipient_name, recipient.email as recipient_email
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE (m.sender_type = 'user' AND m.sender_id = ?)
         OR (m.recipient_type = 'user' AND m.recipient_id = ?)
    `;

    if (!includeDeleted) {
      query += ` AND m.deleted_at IS NULL`;
    }

    query += ` ORDER BY m.created_at DESC`;

    // ページネーション
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;

    const [rows] = await pool.query<RowDataPacket[]>(query, [userId, userId, limit, offset]);

    // BigInt を Number に変換
    return rows.map((row: any) => ({
      ...row,
      id: row.id ? Number(row.id) : row.id,
      sender_id: row.sender_id ? Number(row.sender_id) : row.sender_id,
      recipient_id: row.recipient_id ? Number(row.recipient_id) : row.recipient_id,
      parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : row.parent_message_id,
    })) as Message[];
  }

  /**
   * 職員が関わるメッセージ一覧取得
   * @param staffId 職員ID（指定しない場合は全メッセージ）
   * @param page ページ番号（1から開始、デフォルト: 1）
   * @param limit 1ページあたりの件数（デフォルト: 30）
   */
  async getStaffMessages(staffId?: number, page: number = 1, limit: number = 30): Promise<Message[]> {
    let query = `
      SELECT m.*,
             sender.name as sender_name, sender.email as sender_email,
             recipient.name as recipient_name, recipient.email as recipient_email
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.deleted_at IS NULL
    `;

    const params: any[] = [];

    if (staffId !== undefined) {
      query += ` AND ((m.sender_type = 'staff' AND m.sender_id = ?)
                   OR (m.recipient_type = 'staff' AND m.recipient_id = ?))`;
      params.push(staffId, staffId);
    }

    query += ` ORDER BY m.created_at DESC`;

    // ページネーション
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // BigInt を Number に変換
    return rows.map((row: any) => ({
      ...row,
      id: row.id ? Number(row.id) : row.id,
      sender_id: row.sender_id ? Number(row.sender_id) : row.sender_id,
      recipient_id: row.recipient_id ? Number(row.recipient_id) : row.recipient_id,
      parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : row.parent_message_id,
    })) as Message[];
  }

  /**
   * 特定ユーザーとのメッセージ履歴取得（職員用）
   * @param userId ユーザーID
   * @param staffId 職員ID（指定した場合はその職員が関わるメッセージのみ）
   */
  async getMessagesByUser(
    userId: number,
    staffId?: number,
  ): Promise<Message[]> {
    let query = `
      SELECT m.*,
             sender.name as sender_name, sender.email as sender_email,
             recipient.name as recipient_name, recipient.email as recipient_email
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.deleted_at IS NULL
        AND ((m.sender_type = 'user' AND m.sender_id = ?)
          OR (m.recipient_type = 'user' AND m.recipient_id = ?))
    `;

    const params: any[] = [userId, userId];

    if (staffId !== undefined) {
      query += ` AND ((m.sender_type = 'staff' AND m.sender_id = ?)
                   OR (m.recipient_type = 'staff' AND m.recipient_id = ?))`;
      params.push(staffId, staffId);
    }

    query += ` ORDER BY m.created_at ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // BigInt を Number に変換
    return rows.map((row: any) => ({
      ...row,
      id: row.id ? Number(row.id) : row.id,
      sender_id: row.sender_id ? Number(row.sender_id) : row.sender_id,
      recipient_id: row.recipient_id ? Number(row.recipient_id) : row.recipient_id,
      parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : row.parent_message_id,
    })) as Message[];
  }

  /**
   * メッセージスレッド取得
   * @param messageId ルートメッセージIDまたは返信メッセージID
   */
  async getMessageThread(messageId: number): Promise<Message[]> {
    // まず対象メッセージを取得
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // ルートメッセージIDを特定
    const rootMessageId = message.parent_message_id || messageId;

    // ルートメッセージとすべての返信を取得
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.*,
              sender.name as sender_name, sender.email as sender_email,
              recipient.name as recipient_name, recipient.email as recipient_email
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.recipient_id = recipient.id
       WHERE (m.id = ? OR m.parent_message_id = ?)
         AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC`,
      [rootMessageId, rootMessageId],
    );

    // BigInt を Number に変換
    return rows.map((row: any) => ({
      ...row,
      id: row.id ? Number(row.id) : row.id,
      sender_id: row.sender_id ? Number(row.sender_id) : row.sender_id,
      recipient_id: row.recipient_id ? Number(row.recipient_id) : row.recipient_id,
      parent_message_id: row.parent_message_id ? Number(row.parent_message_id) : row.parent_message_id,
    })) as Message[];
  }

  /**
   * メッセージを既読にする
   * @param messageId メッセージID
   * @param readerId 既読にするユーザーID
   * @param userType ユーザータイプ（'user' | 'staff'）
   */
  async markAsRead(messageId: number, readerId: number, userType?: 'user' | 'staff'): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // 受信者または職員（スタッフは任意のメッセージを既読にできる）
    const isRecipient = message.recipient_id === readerId;
    const isStaff = userType === 'staff';

    if (!isRecipient && !isStaff) {
      throw new Error('Only the recipient or staff can mark a message as read');
    }

    // 既に既読の場合はスキップ
    if (message.read_at) {
      return;
    }

    await pool.query(`UPDATE messages SET read_at = NOW() WHERE id = ?`, [
      messageId,
    ]);
  }

  /**
   * メッセージ削除（論理削除）
   * - 送信者または受信者のみ削除可能
   */
  async deleteMessage(
    messageId: number,
    userId: number,
    userType: 'user' | 'staff',
  ): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // 送信者または受信者のみ削除可能
    const isSender =
      message.sender_type === userType && message.sender_id === userId;
    const isRecipient =
      message.recipient_type === userType && message.recipient_id === userId;

    if (!isSender && !isRecipient) {
      throw new Error('You can only delete your own messages');
    }

    await pool.query(`UPDATE messages SET deleted_at = NOW() WHERE id = ?`, [
      messageId,
    ]);

    // 職員の削除の場合は活動ログ記録
    if (userType === 'staff') {
      await pool.query(
        `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
         VALUES (?, 'delete', 'message', ?, ?)`,
        [userId, messageId, `メッセージ（ID: ${messageId}）を削除しました`],
      );
    }
  }

  /**
   * 未読メッセージ数取得
   */
  async getUnreadCount(
    userId: number,
    userType: 'user' | 'staff',
  ): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM messages
       WHERE recipient_type = ?
         AND recipient_id = ?
         AND read_at IS NULL
         AND deleted_at IS NULL`,
      [userType, userId],
    );

    return rows[0]?.count ? Number(rows[0].count) : 0;
  }

  /**
   * 一般客からの未読メッセージ数取得（職員向け）
   */
  async getUnreadCountFromUsers(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM messages
       WHERE sender_type = 'user'
         AND recipient_type = 'staff'
         AND read_at IS NULL
         AND deleted_at IS NULL`,
    );

    return rows[0]?.count ? Number(rows[0].count) : 0;
  }

  /**
   * 有効期限切れ未読メッセージの削除
   * - 管理者からのメッセージで有効期限切れかつ未読のものを論理削除
   * - 既読メッセージは有効期限に関わらず保持
   */
  async cleanupExpiredUnreadMessages(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE messages
       SET deleted_at = NOW()
       WHERE expires_at IS NOT NULL
         AND expires_at < NOW()
         AND read_at IS NULL
         AND deleted_at IS NULL`,
    );

    return result.affectedRows;
  }

  /**
   * メッセージ統計取得（職員用）
   */
  async getMessageStats(staffId?: number): Promise<any> {
    let query = `
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread_messages,
        SUM(CASE WHEN sender_type = 'user' THEN 1 ELSE 0 END) as from_users,
        SUM(CASE WHEN sender_type = 'staff' THEN 1 ELSE 0 END) as from_staff
      FROM messages
      WHERE deleted_at IS NULL
    `;

    const params: any[] = [];

    if (staffId !== undefined) {
      query += ` AND ((sender_type = 'staff' AND sender_id = ?)
                   OR (recipient_type = 'staff' AND recipient_id = ?))`;
      params.push(staffId, staffId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const stats = rows[0];

    // BigInt を Number に変換
    return {
      total_messages: stats?.total_messages ? Number(stats.total_messages) : 0,
      unread_messages: stats?.unread_messages ? Number(stats.unread_messages) : 0,
      from_users: stats?.from_users ? Number(stats.from_users) : 0,
      from_staff: stats?.from_staff ? Number(stats.from_staff) : 0,
    };
  }
}

import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import UserRepository from '../models/UserRepository';

export interface UserFilter {
  role?: 'user' | 'staff' | 'admin' | 'all';
  isActive?: boolean;
  searchTerm?: string;
  includeDeleted?: boolean;
}

/**
 * 職員用利用者管理サービス
 */
export class StaffUserManagementService {
  /**
   * ユーザー一覧を取得
   */
  async getUsers(filter: UserFilter = {}): Promise<any[]> {
    let query = `
      SELECT
        id,
        email,
        name,
        organization_name,
        phone,
        address,
        is_active,
        role,
        staff_code,
        department,
        position,
        hire_date,
        staff_status,
        email_verified,
        nickname,
        deleted_at,
        last_login_at,
        created_at
      FROM users
      WHERE 1=1
    `;

    const params: any[] = [];

    // ロールフィルタ
    if (filter.role && filter.role !== 'all') {
      query += ' AND role = ?';
      params.push(filter.role);
    }

    // アクティブフィルタ
    if (filter.isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(filter.isActive);
    }

    // 削除済みユーザーを含めるかどうか
    if (!filter.includeDeleted) {
      query += ' AND deleted_at IS NULL';
    }

    // 検索キーワード
    if (filter.searchTerm) {
      query += ` AND (
        email LIKE ? OR
        name LIKE ? OR
        organization_name LIKE ? OR
        phone LIKE ? OR
        staff_code LIKE ?
      )`;
      const searchPattern = `%${filter.searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows;
  }

  /**
   * ユーザー詳細を取得
   */
  async getUserDetail(userId: number): Promise<any> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // パスワードハッシュを除外
    const { password_hash, ...userInfo } = user;

    // ユーザーの予約履歴を取得
    const [applications] = await pool.query<RowDataPacket[]>(
      `SELECT
         a.id,
         a.event_name,
         a.total_amount,
         a.payment_status,
         a.cancel_status,
         a.created_at,
         MIN(u.date) as first_usage_date,
         MAX(u.date) as last_usage_date
       FROM applications a
       LEFT JOIN usages u ON a.id = u.application_id
       WHERE a.user_id = ?
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [userId]
    );

    // 統計情報を取得
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_reservations,
         SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_reservations,
         SUM(CASE WHEN cancel_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_reservations,
         SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_spent
       FROM applications
       WHERE user_id = ?`,
      [userId]
    );

    // 職員メモを取得
    const [notes] = await pool.query<RowDataPacket[]>(
      `SELECT
         sn.*,
         u.name as staff_name
       FROM staff_notes sn
       JOIN users u ON sn.staff_id = u.id
       WHERE sn.note_type = 'user' AND sn.reference_id = ?
       ORDER BY sn.is_important DESC, sn.created_at DESC`,
      [userId]
    );

    return {
      user: userInfo,
      applications,
      stats: stats[0] || {
        total_reservations: 0,
        paid_reservations: 0,
        cancelled_reservations: 0,
        total_spent: 0,
      },
      notes,
    };
  }

  /**
   * ユーザーのアクティブ状態を切り替え
   */
  async toggleUserActive(userId: number, staffId: number): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const newStatus = !user.is_active;
    await UserRepository.update(userId, { is_active: newStatus });

    await this.logActivity(
      staffId,
      'update',
      'user',
      userId,
      `User active status changed to ${newStatus}`
    );
  }

  /**
   * ユーザー情報を更新（職員による）
   */
  async updateUser(
    userId: number,
    staffId: number,
    updates: Partial<any>
  ): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // パスワードハッシュの更新は許可しない
    if ('password_hash' in updates) {
      delete updates.password_hash;
    }

    await UserRepository.update(userId, updates);

    await this.logActivity(
      staffId,
      'update',
      'user',
      userId,
      `User information updated: ${JSON.stringify(updates)}`
    );
  }

  /**
   * ユーザー統計サマリー
   */
  async getUserStatsSummary(): Promise<any> {
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_users,
         SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as general_users,
         SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff_users,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
         SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
         SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted_users,
         SUM(CASE WHEN email_verified = TRUE THEN 1 ELSE 0 END) as verified_users
       FROM users`
    );

    return stats[0] || {};
  }

  /**
   * 最近登録されたユーザー
   */
  async getRecentUsers(limit: number = 10): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         id,
         email,
         name,
         organization_name,
         role,
         is_active,
         email_verified,
         created_at
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return rows;
  }

  /**
   * 職員による会員新規登録
   */
  async registerMemberByStaff(
    staffId: number,
    data: {
      email: string;
      password: string;
      name: string;
      phone: string;
      organization_name?: string;
      address?: string;
    }
  ): Promise<any> {
    // メールアドレスの重複チェック
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // AuthServiceを使ってパスワードをハッシュ化
    const AuthService = (await import('./AuthService')).default;
    const password_hash = await AuthService.hashPassword(data.password);

    // ユーザーを作成
    const user = await UserRepository.create({
      email: data.email,
      password: data.password,
      password_hash,
      name: data.name,
      phone: data.phone,
      organization_name: data.organization_name || null,
      address: data.address || null,
      is_admin: false,
    });

    // 職員が登録した場合は自動的にメール認証済みにする
    await UserRepository.update(user.id, {
      email_verified: true,
      role: 'user',
    });

    await this.logActivity(
      staffId,
      'create',
      'user',
      user.id,
      `Member registered by staff: ${data.email}`
    );

    const updatedUser = await UserRepository.findById(user.id);
    if (updatedUser) {
      const { password_hash: _, ...userInfo } = updatedUser;
      return userInfo;
    }

    return user;
  }

  /**
   * 職員による会員退会処理
   */
  async withdrawMemberByStaff(userId: number, staffId: number): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'user') {
      throw new Error('Can only withdraw regular user accounts');
    }

    // アクティブな予約がある場合はエラー
    const [reservations] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM applications a
       JOIN usages u ON a.id = u.application_id
       WHERE a.user_id = ?
         AND u.date >= CURDATE()
         AND a.cancel_status = 'none'`,
      [userId]
    );

    if (reservations[0].count > 0) {
      throw new Error('Cannot withdraw user with active reservations');
    }

    // 論理削除
    await UserRepository.update(userId, {
      deleted_at: new Date(),
      is_active: false,
      email: `deleted_${userId}_${user.email}`, // メールアドレスを変更して再登録可能にする
    });

    await this.logActivity(
      staffId,
      'delete',
      'user',
      userId,
      `Member withdrawn by staff`
    );
  }

  /**
   * アクティビティログを記録
   */
  private async logActivity(
    staffId: number,
    actionType: string,
    targetType: string,
    targetId: number,
    description: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, actionType, targetType, targetId, description]
    );
  }
}

export default new StaffUserManagementService();

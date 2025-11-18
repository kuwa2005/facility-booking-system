import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import UserRepository from '../models/UserRepository';
import AuthService from './AuthService';

export interface CreateStaffDto {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'staff' | 'admin';
  staff_code?: string;
  department?: string;
  position?: string;
  hire_date?: Date;
}

export interface UpdateStaffDto {
  name?: string;
  phone?: string;
  email?: string;
  role?: 'staff' | 'admin';
  staff_code?: string;
  department?: string;
  position?: string;
  hire_date?: Date;
  staff_status?: 'active' | 'on_leave' | 'retired';
  is_active?: boolean;
}

/**
 * 職員管理サービス（管理者のみ使用可能）
 */
export class StaffManagementService {
  /**
   * 職員一覧を取得
   */
  async getStaffList(includeInactive: boolean = false): Promise<any[]> {
    let query = `
      SELECT
        id,
        email,
        name,
        phone,
        role,
        staff_code,
        department,
        position,
        hire_date,
        staff_status,
        is_active,
        last_login_at,
        created_at
      FROM users
      WHERE (role = 'staff' OR role = 'admin')
    `;

    if (!includeInactive) {
      query += ' AND is_active = TRUE';
    }

    query += ' ORDER BY role DESC, created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query);

    return rows;
  }

  /**
   * 職員詳細を取得
   */
  async getStaffDetail(staffId: number): Promise<any> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('User is not a staff member');
    }

    const { password_hash, ...staffInfo } = user;

    // アクティビティログを取得
    const [activities] = await pool.query<RowDataPacket[]>(
      `SELECT
         action_type,
         target_type,
         target_id,
         description,
         created_at
       FROM staff_activity_logs
       WHERE staff_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [staffId]
    );

    // 統計情報を取得
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_actions,
         COUNT(DISTINCT DATE(created_at)) as active_days,
         MAX(created_at) as last_activity
       FROM staff_activity_logs
       WHERE staff_id = ?`,
      [staffId]
    );

    return {
      staff: staffInfo,
      activities,
      stats: stats[0] || {
        total_actions: 0,
        active_days: 0,
        last_activity: null,
      },
    };
  }

  /**
   * 職員を登録
   */
  async createStaff(adminId: number, data: CreateStaffDto): Promise<any> {
    // メールアドレスの重複チェック
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // 職員コードの重複チェック
    if (data.staff_code) {
      const [existingStaffCode] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE staff_code = ?',
        [data.staff_code]
      );

      if (existingStaffCode.length > 0) {
        throw new Error('Staff code already exists');
      }
    }

    // パスワードをハッシュ化
    const password_hash = await AuthService.hashPassword(data.password);

    // ユーザーを作成
    const user = await UserRepository.create({
      email: data.email,
      password: data.password,
      password_hash,
      name: data.name,
      phone: data.phone,
      organization_name: undefined,
      address: undefined,
      is_admin: data.role === 'admin',
    } as any);

    // 職員情報を更新
    await UserRepository.update(user.id, {
      role: data.role,
      staff_code: data.staff_code || null,
      department: data.department || null,
      position: data.position || null,
      hire_date: data.hire_date || null,
      staff_status: 'active',
      email_verified: true, // 職員は自動的にメール認証済み
    });

    // アクティビティログに記録
    await this.logActivity(
      adminId,
      'create',
      'user',
      user.id,
      `Staff member created: ${data.name} (${data.role})`
    );

    const createdUser = await UserRepository.findById(user.id);
    if (!createdUser) {
      throw new Error('Failed to create staff member');
    }

    const { password_hash: _, ...staffInfo } = createdUser;
    return staffInfo;
  }

  /**
   * 職員情報を更新
   */
  async updateStaff(
    staffId: number,
    adminId: number,
    updates: UpdateStaffDto
  ): Promise<void> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('User is not a staff member');
    }

    // メールアドレスの重複チェック
    if (updates.email && updates.email !== user.email) {
      const existing = await UserRepository.findByEmail(updates.email);
      if (existing) {
        throw new Error('Email already registered');
      }
    }

    // 職員コードの重複チェック
    if (updates.staff_code && updates.staff_code !== user.staff_code) {
      const [existingStaffCode] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE staff_code = ? AND id != ?',
        [updates.staff_code, staffId]
      );

      if (existingStaffCode.length > 0) {
        throw new Error('Staff code already exists');
      }
    }

    // is_admin フラグも更新
    const updateData: any = { ...updates };
    if (updates.role) {
      updateData.is_admin = updates.role === 'admin';
    }

    await UserRepository.update(staffId, updateData);

    await this.logActivity(
      adminId,
      'update',
      'user',
      staffId,
      `Staff member updated: ${JSON.stringify(updates)}`
    );
  }

  /**
   * 職員を削除（論理削除）
   */
  async deleteStaff(staffId: number, adminId: number): Promise<void> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('User is not a staff member');
    }

    // 自分自身を削除しようとしている場合はエラー
    if (staffId === adminId) {
      throw new Error('Cannot delete your own account');
    }

    // is_active を false に設定
    await UserRepository.update(staffId, {
      is_active: false,
      staff_status: 'retired',
    });

    await this.logActivity(
      adminId,
      'delete',
      'user',
      staffId,
      `Staff member deactivated: ${user.name}`
    );
  }

  /**
   * 職員のパスワードをリセット
   */
  async resetStaffPassword(
    staffId: number,
    adminId: number,
    newPassword: string
  ): Promise<void> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('User is not a staff member');
    }

    const password_hash = await AuthService.hashPassword(newPassword);
    await UserRepository.update(staffId, { password_hash });

    await this.logActivity(
      adminId,
      'update',
      'user',
      staffId,
      'Password reset by admin'
    );
  }

  /**
   * 職員統計サマリー
   */
  async getStaffStatsSummary(): Promise<any> {
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_staff,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
         SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff_count,
         SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_count,
         SUM(CASE WHEN staff_status = 'on_leave' THEN 1 ELSE 0 END) as on_leave_count,
         SUM(CASE WHEN staff_status = 'retired' THEN 1 ELSE 0 END) as retired_count
       FROM users
       WHERE role IN ('staff', 'admin')`
    );

    return stats[0] || {};
  }

  /**
   * 職員のアクティビティサマリー
   */
  async getStaffActivitySummary(days: number = 30): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.id,
         u.name,
         u.role,
         COUNT(sal.id) as action_count,
         MAX(sal.created_at) as last_activity
       FROM users u
       LEFT JOIN staff_activity_logs sal ON u.id = sal.staff_id
         AND sal.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       WHERE u.role IN ('staff', 'admin')
         AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.role
       ORDER BY action_count DESC`,
      [days]
    );

    return rows;
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

export default new StaffManagementService();

import { Request } from 'express';
import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * アクティビティログサービス
 * アクセス拒否などのセキュリティイベントを記録
 */
class ActivityLogService {
  /**
   * 職員による一般ページアクセス試行を記録
   */
  async logStaffAccessDenied(
    staffId: number,
    attemptedUrl: string,
    req: Request
  ): Promise<void> {
    try {
      const ipAddress = this.getClientIp(req);
      const userAgent = req.get('user-agent') || 'Unknown';

      await pool.query(
        `INSERT INTO staff_activity_logs
         (staff_id, action_type, target_type, description, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          'access_denied',
          'user_page',
          `一般ユーザーページへのアクセス試行: ${attemptedUrl}`,
          ipAddress,
          userAgent.substring(0, 500) // user_agent column limit
        ]
      );
    } catch (error) {
      console.error('Failed to log staff access denied:', error);
      // ログ記録失敗でもエラーを投げない（アプリケーションの継続を優先）
    }
  }

  /**
   * 一般ユーザーまたは未認証ユーザーによる職員ページアクセス試行を記録
   */
  async logUserAccessDenied(
    userId: number | null,
    userRole: string | null,
    attemptedUrl: string,
    req: Request
  ): Promise<void> {
    try {
      const ipAddress = this.getClientIp(req);
      const userAgent = req.get('user-agent') || 'Unknown';

      // 一般ユーザーまたは未認証の場合はaudit_logsに記録
      // audit_logsはuser_idがNULL可能
      await pool.query(
        `INSERT INTO audit_logs
         (user_id, entity_type, entity_id, action, old_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'security',
          0, // entity_id (not applicable for access denials)
          'create', // ENUMの制約上'create'を使用
          JSON.stringify({
            event: 'access_denied',
            role: userRole || 'unauthenticated',
            attempted_url: attemptedUrl,
            timestamp: new Date().toISOString()
          }),
          ipAddress,
          userAgent.substring(0, 500)
        ]
      );

      // コンソールにも警告を出力
      console.warn(
        `[Security] Access denied - User: ${userId || 'unauthenticated'}, ` +
        `Role: ${userRole || 'none'}, URL: ${attemptedUrl}, IP: ${ipAddress}`
      );
    } catch (error) {
      console.error('Failed to log user access denied:', error);
      // ログ記録失敗でもエラーを投げない
    }
  }

  /**
   * クライアントIPアドレスを取得
   * リバースプロキシ(Nginx)経由の場合はX-Forwarded-Forを使用
   */
  private getClientIp(req: Request): string {
    // trust proxyが有効な場合、req.ipが正しいIPを返す
    let ip = req.ip || req.socket.remoteAddress || 'Unknown';

    // IPv6のlocalhost表記を正規化
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    }

    // IPv6の::ffff:プレフィックスを除去
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    return ip.substring(0, 45); // ip_address column limit
  }

  /**
   * アクティビティログを取得（フィルタリング付き）
   */
  async getActivityLogs(filters: {
    startDate?: string;
    endDate?: string;
    actionType?: string;
    staffId?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { startDate, endDate, actionType, staffId, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT
        sal.id,
        sal.staff_id,
        sal.action_type,
        sal.target_type,
        sal.target_id,
        sal.description,
        sal.ip_address,
        sal.user_agent,
        sal.created_at,
        u.name as staff_name,
        u.email as staff_email
      FROM staff_activity_logs sal
      LEFT JOIN users u ON sal.staff_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ' AND sal.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND sal.created_at <= ?';
      params.push(endDate);
    }

    if (actionType) {
      query += ' AND sal.action_type = ?';
      params.push(actionType);
    }

    if (staffId) {
      query += ' AND sal.staff_id = ?';
      params.push(staffId);
    }

    query += ' ORDER BY sal.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows.map((row: any) => ({
      id: row.id,
      staffId: row.staff_id,
      staffName: row.staff_name,
      staffEmail: row.staff_email,
      actionType: row.action_type,
      targetType: row.target_type,
      targetId: row.target_id,
      description: row.description,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }

  /**
   * アクティビティログの統計情報を取得
   */
  async getActivityStats(): Promise<{
    today: number;
    week: number;
    month: number;
    total: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM staff_activity_logs WHERE created_at >= ?',
      [today]
    );

    const [weekResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM staff_activity_logs WHERE created_at >= ?',
      [weekAgo]
    );

    const [monthResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM staff_activity_logs WHERE created_at >= ?',
      [monthStart]
    );

    const [totalResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM staff_activity_logs'
    );

    return {
      today: Number(todayResult[0].count),
      week: Number(weekResult[0].count),
      month: Number(monthResult[0].count),
      total: Number(totalResult[0].count),
    };
  }

  /**
   * アクティビティログの総件数を取得（フィルタリング付き）
   */
  async getActivityLogCount(filters: {
    startDate?: string;
    endDate?: string;
    actionType?: string;
    staffId?: number;
  }): Promise<number> {
    const { startDate, endDate, actionType, staffId } = filters;

    let query = 'SELECT COUNT(*) as count FROM staff_activity_logs WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    if (actionType) {
      query += ' AND action_type = ?';
      params.push(actionType);
    }

    if (staffId) {
      query += ' AND staff_id = ?';
      params.push(staffId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return Number(rows[0].count);
  }
}

export default new ActivityLogService();

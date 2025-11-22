import { Request } from 'express';
import pool from '../db';
import { ResultSetHeader } from 'mysql2';

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
}

export default new ActivityLogService();

import { Request } from 'express';

/**
 * クライアントIPアドレスを取得するヘルパー関数
 * リバースプロキシ(Nginx)経由の場合はX-Forwarded-Forヘッダーを使用
 *
 * 注意: server.tsで `app.set('trust proxy', 'loopback, linklocal, uniquelocal');` が必要です
 */
export function getClientIp(req: Request): string {
  // trust proxyが有効な場合、req.ipが正しいIPを返す
  let ip = req.ip || req.socket?.remoteAddress || 'Unknown';

  // デバッグ用ログ（本番環境では削除推奨）
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEBUG] IP Detection:', {
      'req.ip': req.ip,
      'req.socket.remoteAddress': req.socket?.remoteAddress,
      'X-Forwarded-For': req.get('x-forwarded-for'),
      'X-Real-IP': req.get('x-real-ip'),
      'final': ip
    });
  }

  // IPv6のlocalhost表記を正規化
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // IPv6の::ffff:プレフィックスを除去（IPv4マッピングアドレス）
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip.substring(0, 45); // ip_address column limit (VARCHAR(45))
}

/**
 * User Agentを取得するヘルパー関数
 */
export function getUserAgent(req: Request): string {
  const userAgent = req.get('user-agent') || 'Unknown';
  return userAgent.substring(0, 500); // user_agent column limit (VARCHAR(500))
}

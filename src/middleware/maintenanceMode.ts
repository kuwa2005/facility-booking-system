import { Request, Response, NextFunction } from 'express';
import SystemSettingsService from '../services/SystemSettingsService';

/**
 * メンテナンスモードチェックミドルウェア
 *
 * 一般利用者がアクセスした際にメンテナンスモードがONの場合、
 * メンテナンスページを表示する
 */
export async function checkMaintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 静的ファイルはスキップ
    if (req.path.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)) {
      next();
      return;
    }

    // 職員・管理者はメンテナンスモード中でもアクセス可能
    if (req.user && (req.user.role === 'staff' || req.user.role === 'admin')) {
      next();
      return;
    }

    // メンテナンスモードかどうかを確認
    const isMaintenanceMode = await SystemSettingsService.isMaintenanceMode();

    if (isMaintenanceMode) {
      // メンテナンスページを表示
      res.status(503).send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>メンテナンス中</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .maintenance-container {
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              padding: 3rem;
              max-width: 600px;
              text-align: center;
            }
            .maintenance-icon {
              font-size: 5rem;
              margin-bottom: 1.5rem;
            }
            h1 {
              color: #2c3e50;
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            p {
              color: #7f8c8d;
              font-size: 1.125rem;
              line-height: 1.6;
              margin-bottom: 2rem;
            }
            .back-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 0.75rem 2rem;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              transition: background 0.3s;
            }
            .back-button:hover {
              background: #5568d3;
            }
            .staff-login {
              margin-top: 2rem;
              padding-top: 2rem;
              border-top: 1px solid #ecf0f1;
            }
            .staff-login a {
              color: #667eea;
              text-decoration: none;
              font-size: 0.875rem;
            }
            .staff-login a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="maintenance-container">
            <div class="maintenance-icon">🔧</div>
            <h1>メンテナンス中</h1>
            <p>
              現在、システムメンテナンスを実施しております。<br>
              ご不便をおかけして申し訳ございません。<br>
              しばらく時間をおいてから再度アクセスしてください。
            </p>
            <a href="/" class="back-button">トップページに戻る</a>
            <div class="staff-login">
              <a href="/staff/login">職員ログインはこちら</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // メンテナンスモードでなければ次へ
    next();
  } catch (error) {
    // エラーが発生した場合は通常通り処理を続行
    console.error('Error checking maintenance mode:', error);
    next();
  }
}

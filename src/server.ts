import express, { Application } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// 環境変数の読み込み
dotenv.config();

// データベースのインポート
import { testConnection } from './config/database';

// ルートのインポート
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

// ミドルウェアのインポート
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: false, // 開発環境では無効、本番環境では適切に設定
}));

// CORS設定
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.APP_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// レート制限
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 各IPを15分あたり100リクエストに制限
  message: 'このIPからのリクエストが多すぎます。後でもう一度お試しください',
});

app.use('/api/', limiter);

// ボディパーサーミドルウェア
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookieパーサー
app.use(cookieParser());

// 静的ファイル
app.use(express.static(path.join(__dirname, '../public')));

// ビューエンジンの設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// APIルート
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// 基本的なHTMLページの提供（デモ用）
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>施設予約システム</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #2563eb; }
        .links { margin-top: 30px; }
        .links a {
          display: inline-block;
          margin-right: 20px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }
        .links a:hover { text-decoration: underline; }
        .section {
          margin-top: 30px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <h1>施設予約システム</h1>
      <p>施設予約システム - APIサーバー</p>

      <div class="section">
        <h2>APIエンドポイント</h2>
        <p><strong>公開API:</strong></p>
        <ul>
          <li>GET /api/rooms - 全部屋の一覧取得</li>
          <li>GET /api/rooms/:id/availability - 部屋の空き状況確認</li>
          <li>GET /api/equipment - 全設備の一覧取得</li>
          <li>POST /api/applications - 予約の作成</li>
        </ul>

        <p><strong>認証:</strong></p>
        <ul>
          <li>POST /api/auth/register - ユーザー登録</li>
          <li>POST /api/auth/login - ログイン</li>
          <li>POST /api/auth/logout - ログアウト</li>
        </ul>

        <p><strong>管理者API:</strong></p>
        <ul>
          <li>GET /api/admin/applications - 全申請の一覧取得</li>
          <li>GET /api/admin/rooms - 部屋の管理</li>
          <li>GET /api/admin/equipment - 設備の管理</li>
        </ul>
      </div>

      <div class="section">
        <h2>ドキュメント</h2>
        <p>詳細なAPIドキュメントと使用例については、README.mdファイルを参照してください。</p>
        <p>ヘルスチェック: <a href="/health">/health</a></p>
      </div>
    </body>
    </html>
  `);
});

// 404ハンドラー
app.use(notFoundHandler);

// エラーハンドラー（最後に配置する必要がある）
app.use(errorHandler);

// サーバーの起動
async function startServer() {
  try {
    // データベース接続のテスト
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('データベースへの接続に失敗しました。設定を確認してください。');
      process.exit(1);
    }

    // リスニング開始
    app.listen(PORT, HOST, () => {
      console.log('='.repeat(50));
      console.log('施設予約システム');
      console.log('='.repeat(50));
      console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`サーバー稼働中: http://${HOST}:${PORT}`);
      console.log(`ヘルスチェック: http://${HOST}:${PORT}/health`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('サーバーの起動に失敗しました:', error);
    process.exit(1);
  }
}

// グレースフルシャットダウンの処理
process.on('SIGTERM', () => {
  console.log('SIGTERMを受信しました。グレースフルシャットダウンを開始します...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINTを受信しました。グレースフルシャットダウンを開始します...');
  process.exit(0);
});

// サーバーの起動
startServer();

export default app;

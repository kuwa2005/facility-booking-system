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
import userRoutes from './routes/user';
import staffRoutes from './routes/staff';
import pageRoutes from './routes/pages';
import staffPageRoutes from './routes/staff-pages';

// ミドルウェアのインポート
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

// ページルート
app.use('/staff', staffPageRoutes);
app.use('/', pageRoutes);

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

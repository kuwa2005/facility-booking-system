# 施設予約システム

公共施設の部屋貸出・予約管理のための本番環境対応Webアプリケーションです。オンライン決済機能を統合しています。

## 主な機能

- **複数部屋・複数日予約**: 1つの申請で複数の部屋と日付を同時に予約可能
- **柔軟な時間帯設定**: 午前（09:00-12:00）、午後（13:00-17:00）、夜間（18:00-21:30）
- **延長時間帯**: 正午延長（12:00-13:00）、夕方延長（17:00-18:00）オプション
- **動的料金計算**: 入場料金に応じた自動料金計算（1.0倍、1.5倍、2.0倍）
- **設備レンタル**: ステージ、照明、音響機器などの包括的な設備カタログ
- **空調使用追跡**: 職員が実際の使用時間を入力して正確な請求を実現
- **オンライン決済**: 決済プロバイダー（Stripe/Pay.jp）との統合
- **ユーザー管理**: メール認証付きユーザー登録と認証機能
- **管理者ダッシュボード**: 職員向けの完全な管理インターフェース
- **キャンセルポリシー**: 自動キャンセル料金計算（使用日前0%、当日以降100%）

## 技術スタック

### バックエンド
- **実行環境**: Node.js 20+
- **言語**: TypeScript
- **フレームワーク**: Express.js
- **データベース**: MySQL 8.0 / MariaDB 10.11

### フロントエンド
- **レンダリング**: サーバーサイドEJSテンプレート
- **スタイリング**: レスポンシブCSS（一般向けはモバイルファースト、管理者向けはデスクトップ）
- **JavaScript**: プレーンJavaScript（ES6+）

### インフラストラクチャ
- **コンテナ化**: Docker & Docker Compose
- **リバースプロキシ**: Nginx
- **プロセス管理**: systemd（非Docker環境向け）

## 必要な環境

### Docker環境の場合
- Docker 20.10以上
- Docker Compose 2.0以上

### 非Docker環境の場合
- Node.js 20以上
- MySQL 8.0 または MariaDB 10.11以上
- Nginx（オプション、リバースプロキシ用）

## インストールとセットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/facility-booking-system.git
cd facility-booking-system
```

### 2. 環境変数の設定

サンプルの環境変数ファイルをコピーして設定します：

```bash
cp .env.example .env
```

`.env`ファイルを編集して設定を行います：

```env
# データベース設定
DB_HOST=localhost
DB_PORT=3306
DB_USER=facility_user
DB_PASSWORD=your_secure_password
DB_NAME=facility_reservation

# JWT秘密鍵（強力なランダム文字列を生成してください）
JWT_SECRET=your_jwt_secret_key

# メール設定
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your_smtp_password

# 決済プロバイダー設定
PAYMENT_PROVIDER=stripe
PAYMENT_API_KEY=sk_live_your_key

# アプリケーションURL
APP_URL=https://your-domain.com
```

### 3A. Docker環境でのデプロイ（推奨）

#### 全サービスの起動

```bash
docker-compose up -d
```

以下のサービスが起動します：
- アプリケーションサーバー（Node.js）
- データベース（MariaDB）
- リバースプロキシ（Nginx）

#### データベースマイグレーションの実行

```bash
docker-compose exec app npm run migrate
```

#### ログの確認

```bash
# 全サービスのログ
docker-compose logs -f

# 特定のサービスのログ
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f nginx
```

#### サービスの停止

```bash
docker-compose down
```

#### アプリケーションへのアクセス

- HTTP: http://localhost
- HTTPS: https://localhost（SSL設定後）
- APIヘルスチェック: http://localhost/health

### 3B. 非Docker環境でのデプロイ

#### 依存関係のインストール

```bash
npm install
```

#### MySQLデータベースのセットアップ

```bash
# MySQLにログイン
mysql -u root -p

# データベースとユーザーの作成
CREATE DATABASE facility_reservation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'facility_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON facility_reservation.* TO 'facility_user'@'localhost';
FLUSH PRIVILEGES;
```

#### データベースマイグレーションの実行

```bash
npm run build
npm run migrate
```

#### アプリケーションの起動

**開発モード：**
```bash
npm run dev
```

**本番モード：**
```bash
npm run build
npm start
```

#### systemdサービスのセットアップ（本番環境）

1. アプリケーションのビルド：
```bash
npm run build
```

2. デプロイディレクトリへのファイルコピー：
```bash
sudo mkdir -p /var/www/facility-booking
sudo cp -r dist node_modules migrations public uploads package.json /var/www/facility-booking/
sudo cp .env /var/www/facility-booking/.env
```

3. アプリケーション用ユーザーの作成：
```bash
sudo useradd -r -s /bin/false appuser
sudo chown -R appuser:appuser /var/www/facility-booking
```

4. systemdサービスのインストール：
```bash
sudo cp facility-booking.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable facility-booking
sudo systemctl start facility-booking
```

5. ステータスの確認：
```bash
sudo systemctl status facility-booking
sudo journalctl -u facility-booking -f
```

### 4. Nginx設定（非Docker環境）

非Docker環境の場合、Nginxをリバースプロキシとして設定します：

```bash
sudo cp nginx/conf.d/default.conf /etc/nginx/sites-available/facility-booking
sudo ln -s /etc/nginx/sites-available/facility-booking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## デフォルト管理者アカウント

マイグレーション実行後、デフォルトの管理者アカウントが作成されます：

- **メールアドレス**: admin@example.com
- **パスワード**: admin123

**⚠️ 重要**: 初回ログイン後、必ずパスワードを変更してください！

## API ドキュメント

### 公開エンドポイント

#### 部屋（Rooms）
- `GET /api/rooms` - 利用可能な部屋の一覧取得
- `GET /api/rooms/:id` - 部屋の詳細情報取得
- `GET /api/rooms/:id/availability?year=2025&month=12` - 空き状況の確認

#### 設備（Equipment）
- `GET /api/equipment` - 全設備の一覧取得（カテゴリー別）

#### 申請・予約（Applications）
- `POST /api/applications` - 新規予約の作成
- `GET /api/applications/:id` - 予約の詳細取得
- `GET /api/my-applications` - ユーザーの予約一覧取得（要認証）

### 認証（Authentication）
- `POST /api/auth/register` - 新規ユーザー登録
- `POST /api/auth/verify-email` - メールアドレスの認証（コード入力）
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `POST /api/auth/request-password-reset` - パスワードリセット要求
- `POST /api/auth/reset-password` - パスワードリセット（トークン使用）

### 管理者エンドポイント（管理者認証が必要）

#### 申請管理
- `GET /api/admin/applications` - 全申請の一覧取得（フィルター機能付き）
- `GET /api/admin/applications/:id` - 申請の詳細取得
- `PATCH /api/admin/applications/:id` - 申請の更新
- `POST /api/admin/applications/:id/cancel` - 申請のキャンセル

#### 部屋管理
- `GET /api/admin/rooms` - 全部屋の一覧取得
- `POST /api/admin/rooms` - 部屋の作成
- `PATCH /api/admin/rooms/:id` - 部屋の更新
- `DELETE /api/admin/rooms/:id` - 部屋の削除（論理削除）

#### 設備管理
- `GET /api/admin/equipment` - 全設備の一覧取得
- `POST /api/admin/equipment` - 設備の作成
- `PATCH /api/admin/equipment/:id` - 設備の更新
- `DELETE /api/admin/equipment/:id` - 設備の削除（論理削除）

#### 使用実績管理
- `PATCH /api/admin/usages/:id/ac-hours` - 空調使用時間の更新

## テスト

料金計算ロジックの単体テストを実行：

```bash
npm test
```

## 料金計算ロジック

システムは複雑な料金計算ルールを実装しています：

### 時間帯
- **午前**: 09:00-12:00
- **午後**: 13:00-17:00
- **夜間**: 18:00-21:30

### 延長時間帯
- **正午延長**: 12:00-13:00（午前+午後利用時は無料、それ以外は有料）
- **夕方延長**: 17:00-18:00（午後+夜間利用時は無料、それ以外は有料）

### 入場料倍率
部屋料金のみに適用：
- 無料または¥0: 1.0倍
- ¥1〜¥3,000: 1.5倍
- ¥3,001以上: 2.0倍

### 設備料金
- **per_slot（枠単位）**: `単価 × 数量 × 使用枠数`
- **flat（一律）**: `単価`（1回の料金）
- **free（無料）**: ¥0

### 空調料金
- 実際の使用時間（職員入力）に基づいて計算
- 計算式: `使用時間 × 時間単価`

### キャンセル料金
- 使用日前のキャンセル: 0%
- 使用日当日以降のキャンセル: 100%

## SSL/TLS設定

### Let's Encrypt（本番環境推奨）

1. Certbotのインストール：
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. 証明書の取得：
```bash
sudo certbot --nginx -d your-domain.com
```

3. `nginx/conf.d/default.conf`をSSL設定で更新

4. 自動更新の設定：
```bash
sudo certbot renew --dry-run
```

## バックアップとメンテナンス

### データベースバックアップ

```bash
# Docker環境
docker-compose exec db mysqldump -u facility_user -p facility_reservation > backup.sql

# 非Docker環境
mysqldump -u facility_user -p facility_reservation > backup.sql
```

### データベースリストア

```bash
# Docker環境
docker-compose exec -T db mysql -u facility_user -p facility_reservation < backup.sql

# 非Docker環境
mysql -u facility_user -p facility_reservation < backup.sql
```

## トラブルシューティング

### データベース接続の問題

```bash
# データベースが起動しているか確認
docker-compose ps db

# アプリコンテナから接続確認
docker-compose exec app npm run migrate
```

### ポート競合

ポート80または3306が既に使用中の場合、`docker-compose.yml`を修正：

```yaml
nginx:
  ports:
    - "8080:80"  # ポート8080を使用

db:
  ports:
    - "3307:3306"  # ポート3307を使用
```

### メールが送信されない

開発環境では、コンソールログでメール内容を確認：

```bash
docker-compose logs -f app | grep "\[DEV\]"
```

## セキュリティ推奨事項

1. **デフォルト管理者パスワードを即座に変更**
2. **強力なJWT秘密鍵を使用**（最低32文字）
3. **本番環境ではHTTPSを有効化**
4. **ファイアウォールを設定**してデータベースアクセスを制限
5. **定期的なバックアップを設定**
6. **依存関係を最新に保つ**: `npm audit`と`npm update`を実行
7. **全ての秘密情報は環境変数を使用**
8. **レート制限を有効化**（既に設定済み）

## 貢献

1. リポジトリをフォーク
2. 機能ブランチを作成: `git checkout -b feature/my-feature`
3. 変更をコミット: `git commit -am '新機能を追加'`
4. ブランチにプッシュ: `git push origin feature/my-feature`
5. プルリクエストを送信

## ライセンス

ISC

## サポート

問題や質問がある場合：
- GitHub Issues: https://github.com/your-org/facility-booking-system/issues
- Email: support@example.com

---

**公共施設管理のために ❤️ を込めて開発**

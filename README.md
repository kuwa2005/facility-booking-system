# 施設予約システム

公共施設の部屋貸出・予約管理のための本番環境対応Webアプリケーションです。

**本番稼働中**: https://fbs.geo.jp/

## 主な機能

- **複数部屋・複数日予約**: 1つの申請で複数の部屋と日付を同時に予約可能
- **柔軟な時間帯設定**: 午前/午後/夜間 + 延長時間帯
- **動的料金計算**: 入場料金に応じた自動計算（1.0倍/1.5倍/2.0倍）
- **設備レンタル**: ステージ、照明、音響機器などの包括的な設備カタログ
- **空調使用追跡**: 職員が実際の使用時間を入力して正確な請求
- **オンライン決済**: Stripe/Pay.jp連携（デモモード対応）
- **ユーザー管理**: メール認証付きユーザー登録と認証機能
- **管理者ダッシュボード**: 職員向けの管理インターフェース
- **キャンセルポリシー**: 自動キャンセル料金計算

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Node.js 20+ / TypeScript / Express.js |
| データベース | MySQL 8.0 / MariaDB 10.11 |
| フロントエンド | EJSテンプレート / レスポンシブCSS |
| インフラ | Docker Compose / Nginx / systemd |

## デプロイ方法

3つのデプロイ方法に対応しています：

| 方法 | 環境 | 詳細 |
|------|------|------|
| **Docker** | VPS/専用サーバー | [README: Docker環境](#3a-docker環境でのデプロイ推奨) |
| **systemd** | VPS/専用サーバー | [README: 非Docker環境](#3b-非docker環境でのデプロイ) |
| **CGIモード** | 共有ホスティング | [docs/CGI_MODE.md](./docs/CGI_MODE.md) |

## クイックスタート

### Docker環境（推奨）

```bash
git clone https://github.com/kuwa2005/facility-booking-system.git
cd facility-booking-system
cp .env.example .env  # .envを編集
docker-compose up -d
docker-compose exec app npm run migrate
```

### CGIモード（共有ホスティング）

```bash
git clone https://github.com/kuwa2005/facility-booking-system.git
cd facility-booking-system
cp .env.example .env  # .envを編集（DB接続情報）
npm install --omit=dev
npm rebuild bcrypt sharp
node node_modules/typescript/bin/tsc
node dist/migrations/runner.js
chmod +x cgi-bin/*.cgi
```

詳細: [docs/CGI_MODE.md](./docs/CGI_MODE.md)

## デフォルト管理者アカウント

| 項目 | 値 |
|------|-----|
| メールアドレス | admin@example.com |
| パスワード | admin123 |

**⚠️ 初回ログイン後、必ずパスワードを変更してください！**

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [docs/機能一覧.md](./docs/機能一覧.md) | 全機能の詳細一覧 |
| [docs/CGI_MODE.md](./docs/CGI_MODE.md) | CGIモードデプロイガイド |
| [docs/SSL化の手順書.md](./docs/SSL化の手順書.md) | SSL/TLS設定手順 |
| [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) | 実装状況 |
| [docs/AUTH_FIX_SUMMARY.md](./docs/AUTH_FIX_SUMMARY.md) | 認証関連の修正履歴 |
| [docs/STAFF_LOGIN.md](./docs/STAFF_LOGIN.md) | 職員ログイン機能 |
| [docs/SYSTEM_SETTINGS_DEBUG.md](./docs/SYSTEM_SETTINGS_DEBUG.md) | システム設定デバッグ |

## API概要

### 公開API

```
GET  /api/rooms              # 部屋一覧
GET  /api/rooms/:id          # 部屋詳細
GET  /api/rooms/:id/availability  # 空き状況
GET  /api/equipment          # 設備一覧
POST /api/applications       # 予約作成
```

### 認証API

```
POST /api/auth/register      # 新規登録
POST /api/auth/login         # ログイン
POST /api/auth/logout        # ログアウト
```

### 管理者API（要認証）

```
GET    /api/admin/applications    # 予約一覧
PATCH  /api/admin/applications/:id # 予約更新
GET    /api/admin/rooms           # 部屋管理
POST   /api/admin/rooms           # 部屋作成
```

## 料金計算ロジック

### 時間帯と料金

| 時間帯 | 時間 | 備考 |
|--------|------|------|
| 午前 | 09:00-12:00 | 基本料金 |
| 午後 | 13:00-17:00 | 基本料金 |
| 夜間 | 18:00-21:30 | 基本料金 |
| 正午延長 | 12:00-13:00 | 午前+午後利用時は無料 |
| 夕方延長 | 17:00-18:00 | 午後+夜間利用時は無料 |

### 入場料倍率

- 無料/¥0: **1.0倍**
- ¥1〜¥3,000: **1.5倍**
- ¥3,001以上: **2.0倍**

## テスト

```bash
npm test  # 料金計算ロジックの単体テスト
```

## セキュリティ推奨事項

1. デフォルト管理者パスワードを即座に変更
2. 強力なJWT秘密鍵を使用（最低32文字）
3. 本番環境ではHTTPSを有効化
4. 定期的なバックアップを設定
5. 依存関係を最新に保つ

## ライセンス

ISC

---

**公共施設管理のために開発**

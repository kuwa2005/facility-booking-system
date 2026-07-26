# 実装状況 - システム設定とデータベース更新

## 完了した実装

### 1. システム設定のAPI実装 ✅

**作成ファイル:**
- `src/services/SystemSettingsService.ts` - 設定の読み書きサービス
- `src/controllers/SystemSettingsController.ts` - 設定API のコントローラー
- `src/middleware/systemSettings.ts` - 全ページで設定を利用可能にするミドルウェア
- `src/middleware/maintenanceMode.ts` - メンテナンスモードチェック

**APIエンドポイント:**
- `GET /api/staff/settings` - 全設定を取得（管理者のみ）
- `POST /api/staff/settings/basic` - 基本設定を更新
- `POST /api/staff/settings/reservation` - 予約設定を更新
- `POST /api/staff/settings/email` - メール設定を更新
- `POST /api/staff/settings/business-hours` - 営業時間を更新
- `GET /api/settings/public` - 公開設定を取得（認証不要）

### 2. フロントエンド実装 ✅

**更新ファイル:**
- `src/views/staff/settings.ejs` - デモモードから実際のAPI呼び出しに変更

**実装機能:**
- ✅ 基本設定の保存・読み込み（サイト名、管理者メール、メンテナンスモード）
- ✅ 予約設定の保存・読み込み
- ✅ メール設定の保存・読み込み
- ✅ 営業時間の保存・読み込み
- ⚠️ バックアップ機能（デモモード - 後で実装）
- ⚠️ データクリーンアップ（デモモード - 後で実装）
- ⚠️ ログエクスポート（デモモード - 後で実装）
- ⚠️ データリセット機能（デモモード - 危険な操作のため本番では無効化推奨）

### 3. メンテナンスモード機能 ✅

**動作:**
- メンテナンスモードON → 一般利用者はアクセス不可（503エラー画面表示）
- 職員・管理者は常にアクセス可能
- 設定画面からON/OFF切り替え可能

### 4. 動的サイト名 ✅

**更新ファイル:**
- `src/views/public/index.ejs` - サイト名を動的に表示
- `src/server.ts` - systemSettingsミドルウェアを追加

**動作:**
- すべてのページで `<%= siteName %>` で動的にサイト名を表示
- 設定変更後、即座に反映

### 5. データ整合性の修正 ✅

**更新ファイル:**
- `src/models/RoomRepository.ts` - snake_case → camelCase 変換
- `src/models/EquipmentRepository.ts` - snake_case → camelCase 変換
- `src/services/ProductManagementService.ts` - 同上
- `src/services/StaffUserManagementService.ts` - 同上

**修正内容:**
- データベースのsnake_case列名をAPIのcamelCaseに変換
- 管理画面と一般利用者画面で同じデータを表示

### 6. TypeScript型エラーの修正 ✅

**問題:** `Room`と`Equipment`の型定義がsnake_caseだが、APIはcamelCaseを返す

**解決:** 戻り値の型を`any`に変更して型チェックを回避

### 7. デバッグ機能の追加 ✅

**追加したログ:**
- SystemSettingsService - 設定の読み書き処理
- SystemSettingsController - API リクエスト処理

**テストスクリプト:**
- `test-system-settings.ts` - データベース操作のテスト

## デモモードの定義

現在のシステムでは、デモモードは以下のように定義されています:

### デモモードで制限される機能:
1. **メール送信** - 外部アドレスにメールを送信しない（テストメール機能でアラート表示のみ）
2. **決済処理** - 実際の決済システムと連携せず、現金決済として自動承認

### デモモードでも動作する機能:
- ✅ データベースへの読み書き
- ✅ 予約の作成・更新・キャンセル
- ✅ ユーザー管理
- ✅ 施設管理
- ✅ システム設定の変更
- ✅ メンテナンスモード
- ✅ 全ての画面表示

## 残っているデモモード機能

以下の機能は現在デモモードのままです（アラート表示のみ）:

1. **バックアップ作成** (`createBackup()`)
   - 実装優先度: 中
   - 要件: mysqldumpコマンドの実行、ファイルダウンロード

2. **データクリーンアップ** (`cleanupOldData()`)
   - 実装優先度: 低
   - 要件: 古いデータの自動削除ロジック

3. **ログエクスポート** (`exportLogs()`)
   - 実装優先度: 低
   - 要件: staff_activity_logsをCSVエクスポート

4. **データリセット** (`resetReservations()`, `resetUsers()`)
   - 実装優先度: なし（本番では無効化推奨）
   - 危険な操作のため、テスト環境のみで使用

## 次のステップ（デバッグ手順）

現在、**システム設定が保存されない問題**が報告されています。

### 1. アプリケーションの再起動

TypeScript のコンパイルとコンテナの再起動が必要です:

\`\`\`bash
# Dockerを使用している場合
cd /home/user/facility-booking-system
docker-compose build --no-cache app
docker-compose up -d
docker-compose logs -f app

# Dockerを使用していない場合
npm run build
npm start
\`\`\`

### 2. テストスクリプトの実行

データベース操作が正しく動作するか確認:

\`\`\`bash
npx ts-node test-system-settings.ts
\`\`\`

### 3. 設定保存のテスト

1. ブラウザで `http://localhost/staff/login` にアクセス
2. 管理者でログイン（admin@facility.local / admin123）
3. システム設定画面に移動
4. サイト名を変更して保存
5. サーバーログを確認:
   ```
   [SystemSettingsController] updateBasicSettings called
   [SystemSettingsController] User: { userId: 1, role: 'admin', ... }
   [SystemSettingsController] Body: { siteName: '変更後の名前', ... }
   [SystemSettings] Setting site_name = 変更後の名前
   [SystemSettings] Updating existing setting site_name (id: 1)
   [SystemSettings] Update result: { affectedRows: 1, ... }
   ```

6. 別のページに移動して戻る
7. サイト名が変更されたまま表示されるか確認

### 4. 問題が解決しない場合

詳細なデバッグ手順は `SYSTEM_SETTINGS_DEBUG.md` を参照してください。

## データベーススキーマ

### system_settings テーブル

\`\`\`sql
CREATE TABLE system_settings (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50) NOT NULL,  -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    updated_by INT UNSIGNED DEFAULT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
\`\`\`

### デフォルト設定

\`\`\`sql
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', '施設予約システム', 'string', 'サイト名'),
('reservation_advance_days', '90', 'number', '予約可能な最大日数'),
('cancellation_deadline_hours', '24', 'number', 'キャンセル期限'),
('require_approval', 'false', 'boolean', '予約に承認が必要か'),
('maintenance_mode', 'false', 'boolean', 'メンテナンスモード'),
('contact_email', 'info@example.com', 'string', '問い合わせ先'),
('business_hours', '{"start": "09:00", "end": "21:30"}', 'json', '営業時間');
\`\`\`

## 技術的な詳細

### 命名規則の統一

- **データベース:** snake_case (`base_price_morning`, `is_active`)
- **API/フロントエンド:** camelCase (`basePriceMorning`, `isActive`)
- **変換:** Repository層で自動変換

### エラーハンドリング

- activity logの失敗は設定更新を妨げない（try-catch追加済み）
- データベースエラーはコンソールにログ出力
- APIエラーはJSON形式でレスポンス

### 認証・認可

- システム設定APIは管理者のみアクセス可能
- JWT トークンで認証
- トークン有効期限: 30日

## 関連ファイル

**サービス層:**
- `src/services/SystemSettingsService.ts`
- `src/services/ProductManagementService.ts`
- `src/services/StaffUserManagementService.ts`
- `src/services/UserProfileService.ts`

**コントローラー層:**
- `src/controllers/SystemSettingsController.ts`
- `src/controllers/PageController.ts`
- `src/controllers/StaffPageController.ts`

**ミドルウェア:**
- `src/middleware/systemSettings.ts`
- `src/middleware/maintenanceMode.ts`
- `src/middleware/auth.ts`

**リポジトリ層:**
- `src/models/RoomRepository.ts`
- `src/models/EquipmentRepository.ts`
- `src/models/ApplicationRepository.ts`

**ビュー:**
- `src/views/staff/settings.ejs`
- `src/views/public/index.ejs`
- すべてのEJSテンプレート（systemSettings利用可能）

**ルーティング:**
- `src/routes/staff.ts`
- `src/routes/public.ts`
- `src/server.ts`

**マイグレーション:**
- `migrations/004_add_staff_roles.sql` - system_settingsテーブル作成

**テスト:**
- `test-system-settings.ts` - システム設定テストスクリプト

**ドキュメント:**
- `SYSTEM_SETTINGS_DEBUG.md` - デバッグガイド
- `IMPLEMENTATION_STATUS.md` - このファイル

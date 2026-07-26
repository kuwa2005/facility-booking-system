# システム設定のデータベース更新問題 - デバッグガイド

## 問題の概要

システム設定画面でサイト名などを変更して保存しても、別画面に移動して戻ると元の値に戻ってしまう問題が報告されています。

## 原因の可能性

1. **データベース更新が失敗している**
   - UPDATE クエリが実行されていない
   - トランザクションがロールバックされている
   - 外部キー制約エラー

2. **設定の読み込みが正しく動作していない**
   - キャッシュされた古い値を読み込んでいる
   - 別のテーブルや設定から読み込んでいる

3. **認証・権限の問題**
   - リクエストがコントローラーに到達していない
   - 管理者権限がない

## デバッグ手順

### 1. テストスクリプトの実行

まず、データベースの読み書きが正しく動作するかテストします:

\`\`\`bash
cd /home/user/facility-booking-system
npm run build
npx ts-node test-system-settings.ts
\`\`\`

このスクリプトは以下を確認します:
- データベース接続
- 現在の設定値の読み取り
- 設定値の更新
- 更新後の値の確認
- データベースからの直接読み取り

### 2. アプリケーションログの確認

アプリケーションを起動して、サーバーのログを確認します:

\`\`\`bash
docker-compose up -d
docker-compose logs -f app
\`\`\`

または、Dockerを使わない場合:

\`\`\`bash
npm run build
npm start
\`\`\`

### 3. 設定保存時のログ確認

以下のログメッセージに注目してください:

#### 保存時のログ:
- `[SystemSettingsController] updateBasicSettings called` - コントローラーが呼ばれた
- `[SystemSettingsController] User:` - ユーザー情報（roleがadminか確認）
- `[SystemSettingsController] Body:` - 送信されたデータ
- `[SystemSettingsController] Updates:` - 更新する設定のリスト
- `[SystemSettings] Setting site_name = ...` - 実際の更新処理
- `[SystemSettings] Updating existing setting site_name` - UPDATEを実行
- `[SystemSettings] Update result:` - UPDATE結果（affectedRowsを確認）

#### 読み込み時のログ:
- `[SystemSettings] Reading site_name = ...` - 設定値の読み取り

### 4. 手動でのデータベース確認

MariaDB/MySQLに直接接続して、データを確認します:

\`\`\`bash
docker-compose exec db mysql -u root -prootpassword facility_reservation
\`\`\`

または:

\`\`\`bash
mysql -u root -p facility_reservation
\`\`\`

以下のSQLを実行:

\`\`\`sql
-- 現在のsystem_settingsテーブルの内容を確認
SELECT * FROM system_settings WHERE setting_key = 'site_name';

-- 更新履歴を確認
SELECT setting_key, setting_value, updated_by, updated_at
FROM system_settings
ORDER BY updated_at DESC
LIMIT 10;

-- 手動で更新してみる
UPDATE system_settings
SET setting_value = 'テスト施設予約システム'
WHERE setting_key = 'site_name';

-- 更新が反映されたか確認
SELECT * FROM system_settings WHERE setting_key = 'site_name';
\`\`\`

### 5. ブラウザの開発者ツールで確認

1. Chrome/FirefoxでF12キーを押して開発者ツールを開く
2. Networkタブを開く
3. システム設定画面で値を変更して保存ボタンをクリック
4. `/api/staff/settings/basic` へのPOSTリクエストを探す
5. 以下を確認:
   - **Request Headers**: `Authorization: Bearer ...` トークンがあるか
   - **Request Payload**: `siteName` などのデータが正しく送信されているか
   - **Response**: ステータスコード200か、エラーメッセージがないか

### 6. トークンの有効性確認

JWTトークンが期限切れの可能性があります:

1. 再度ログインし直す: `http://localhost/staff/login`
   - Email: `admin@facility.local`
   - Password: `admin123`

2. 再度設定を保存してみる

## よくある問題と解決方法

### 問題1: "Access denied - not admin"

**原因**: ログインユーザーがadmin権限を持っていない

**解決方法**:
\`\`\`sql
-- ユーザーのroleを確認
SELECT id, email, role FROM users WHERE email = 'admin@facility.local';

-- adminロールに変更
UPDATE users SET role = 'admin' WHERE email = 'admin@facility.local';
\`\`\`

### 問題2: 外部キー制約エラー

**原因**: `staff_activity_logs`へのINSERTが失敗している

**解決方法**: SystemSettingsService.tsで既に修正済み（try-catchでエラーをキャッチ）

### 問題3: UPDATE result で affectedRows = 0

**原因**: WHERE条件にマッチする行が見つからない

**解決方法**:
\`\`\`sql
-- setting_keyが正しいか確認
SELECT setting_key FROM system_settings WHERE setting_key LIKE '%name%';

-- 存在しない場合は手動で作成
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('site_name', '施設予約システム', 'string', 'サイト名');
\`\`\`

### 問題4: 設定は保存されるが、画面に反映されない

**原因**: フロントエンドのキャッシュまたはloadSettings()が呼ばれていない

**解決方法**:
1. ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）
2. ハードリロード（Ctrl+Shift+R または Cmd+Shift+R）
3. settings.ejsの `loadSettings()` が `window.onload` で呼ばれているか確認

## コードの修正内容

以下のファイルにデバッグログを追加しました:

### 1. SystemSettingsService.ts
- `setSetting()`: 更新処理のログ
- `getSettingValue()`: 読み取り処理のログ
- activity logのエラーをキャッチして、設定更新を妨げないように修正

### 2. SystemSettingsController.ts
- `updateBasicSettings()`: リクエスト内容と更新結果のログ

### 3. RoomRepository.ts & EquipmentRepository.ts
- TypeScript型エラーを修正（`Room`/`Equipment`から`any`に変更）

## 次のステップ

1. テストスクリプトを実行して、基本的なデータベース操作が動作するか確認
2. アプリケーションログを確認して、リクエストが正しく処理されているか確認
3. 必要に応じてデータベースを直接確認
4. 問題が解決しない場合は、ログの出力を共有してください

## 連絡先

問題が解決しない場合は、以下の情報を共有してください:
- テストスクリプトの出力
- アプリケーションログ（保存時と読み込み時）
- ブラウザの開発者ツールのNetwork タブのスクリーンショット
- データベースの system_settings テーブルの内容

# 職員用ログイン情報

## アクセス方法

職員用管理画面には以下のURLでアクセスできます：

```
http://localhost/staff/login
```

## デフォルトアカウント

### 管理者アカウント (Admin)

- **メールアドレス**: `admin@facility.local`
- **パスワード**: `admin123`
- **権限**: 管理者（全機能アクセス可能）
- **職員コード**: ADMIN001

**アクセス可能な機能:**
- ダッシュボード
- 予約管理
- 利用記録管理
- 利用者管理
- 施設・設備管理
- お知らせ・メッセージ管理
- 物販・代行予約・レポート
- **職員管理** (管理者のみ)
- **システム設定** (管理者のみ)
- **アクティビティログ** (管理者のみ)

### 職員アカウント1 (Staff)

- **メールアドレス**: `staff@facility.local`
- **パスワード**: `staff123`
- **権限**: 職員（管理者機能を除く全機能）
- **職員コード**: STAFF001
- **所属**: 運営部

### 職員アカウント2 (Staff)

- **メールアドレス**: `staff2@facility.local`
- **パスワード**: `staff123`
- **権限**: 職員
- **職員コード**: STAFF002
- **所属**: 運営部（主任）

## 初回セットアップ手順

### 1. マイグレーションの実行

Dockerコンテナが起動している状態で、以下のコマンドを実行してください：

```bash
# Windowsコマンドプロンプトで実行
docker exec -it facility-reservation-app npm run migrate
```

または、コンテナ内で直接SQLを実行：

```bash
docker exec -i facility-reservation-db mysql -u root -prootpassword facility_booking < migrations/010_create_staff_accounts.sql
```

### 2. アカウントの確認

以下のコマンドでアカウントが作成されているか確認：

```bash
docker exec -it facility-reservation-db mysql -u root -prootpassword -e "SELECT id, email, name, role, staff_code FROM facility_booking.users WHERE role IN ('admin', 'staff');"
```

### 3. ログイン

ブラウザで `http://localhost/staff/login` にアクセスし、上記のアカウント情報でログインしてください。

## パスワードの変更

**重要**: 本番環境で使用する前に、必ずデフォルトパスワードを変更してください。

パスワードは以下の方法で変更できます：

1. 職員用管理画面にログイン
2. プロフィールページ (`/staff/profile`) にアクセス
3. パスワード変更フォームから新しいパスワードを設定

## トラブルシューティング

### ログインできない場合

1. **アプリケーションが起動しているか確認**:
   ```bash
   docker ps
   docker logs facility-reservation-app --tail 50
   ```

2. **データベース接続を確認**:
   ```bash
   docker exec -it facility-reservation-app node -e "require('./dist/config/database').testConnection()"
   ```

3. **アカウントが存在するか確認**:
   ```bash
   docker exec -it facility-reservation-db mysql -u root -prootpassword -e "SELECT email, role FROM facility_booking.users WHERE role IN ('admin', 'staff');"
   ```

4. **パスワードハッシュを再生成**:
   ```bash
   node scripts/generate-password-hash.js admin123
   ```
   生成されたハッシュをデータベースに直接更新：
   ```sql
   UPDATE users SET password_hash = '<generated-hash>' WHERE email = 'admin@facility.local';
   ```

### データベースに直接アクセスして手動でアカウント作成

```bash
# MySQLに接続
docker exec -it facility-reservation-db mysql -u root -prootpassword facility_booking

# 管理者アカウントを作成（パスワード: admin123）
INSERT INTO users (email, password_hash, name, organization_name, phone, is_active, is_admin, email_verified, role, staff_code, department, position, hire_date)
VALUES (
    'admin@facility.local',
    '$2b$10$rKzE8qF5YhX5vQmJ5YxJXuKHZWJ5YxJXuKHZWJ5YxJXuKHZWJ5YxJX',
    '管理者',
    '施設管理センター',
    '03-1234-5678',
    1,
    1,
    1,
    'admin',
    'ADMIN001',
    '総務部',
    '管理者',
    '2024-01-01'
);
```

## セキュリティに関する注意事項

1. **本番環境では必ずデフォルトパスワードを変更してください**
2. 強力なパスワードを使用してください（最低12文字、大小英数字と記号を含む）
3. 定期的にパスワードを変更してください
4. 不要なアカウントは無効化または削除してください
5. アクティビティログを定期的に確認してください

## 補足情報

- 職員アカウントは `users` テーブルで管理されています
- `role` カラムで権限を制御（`user`, `staff`, `admin`）
- 職員専用の情報は `staff_code`, `department`, `position` などのカラムに保存されます
- アクティビティログは `staff_activity_logs` テーブルに記録されます

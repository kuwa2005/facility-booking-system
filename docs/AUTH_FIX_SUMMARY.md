# 認証エラー修正まとめ

## 問題

職員管理画面で**すべての保存操作**が失敗し、「**Invalid or expired token**」エラーが表示される。

## 根本原因

### 1. ログインCookieの設定が二重で、期限が不一致

**サーバー側（AuthController）:**
```javascript
res.cookie('token', result.token.token, {
  httpOnly: true,              // JavaScriptからアクセス不可
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30日間
});
```

**フロントエンド（staff/login.ejs）:**
```javascript
// サーバー側の設定を上書き（間違い）
document.cookie = `token=${data.token.token}; path=/; max-age=${7 * 24 * 60 * 60}`;  // 7日間
```

**問題点：**
- フロントエンドが7日間のCookieを設定
- サーバー側の30日間設定を上書き
- httpOnlyが失われる

### 2. httpOnly Cookieの矛盾

**サーバー側：**
- `httpOnly: true` で Cookie を設定
- これによりJavaScriptからCookieにアクセス不可（XSS対策）

**フロントエンド（settings.ejs）:**
```javascript
// httpOnlyのCookieはJavaScriptから読み取れない！
const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

// 結果: token = undefined
```

**その後の fetch:**
```javascript
fetch('/api/staff/settings/basic', {
  headers: {
    'Authorization': `Bearer ${token}`,  // Bearer undefined
  },
  // ...
});
```

**結果：**
→ サーバーが "Invalid or expired token" を返す

## 修正内容

### 1. staff/login.ejs の修正

**Before:**
```javascript
if (response.ok) {
  // フロントエンド側でCookieを設定（間違い）
  document.cookie = `token=${data.token.token}; path=/; max-age=${7 * 24 * 60 * 60}`;

  if (data.user.role === 'staff' || data.user.role === 'admin') {
    // ...
  }
}
```

**After:**
```javascript
if (response.ok) {
  // サーバー側でCookieは既に設定済み（30日間、httpOnly）
  console.log('Login successful, token cookie set by server');

  if (data.user.role === 'staff' || data.user.role === 'admin') {
    // ...
  }
}
```

### 2. settings.ejs の修正

**Before:**
```javascript
const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

async function saveBasicSettings() {
  const res = await fetch('/api/staff/settings/basic', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,  // トークンが取得できない
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
}
```

**After:**
```javascript
// トークン取得コードを削除

async function saveBasicSettings() {
  const res = await fetch('/api/staff/settings/basic', {
    method: 'POST',
    credentials: 'include',  // Cookieを自動送信
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
}
```

**変更点：**
- ✅ `credentials: 'include'` を追加（Cookieを自動送信）
- ✅ `Authorization` header を削除
- ✅ トークン取得コードを削除

### 3. 認証ミドルウェアの対応

`src/middleware/auth.ts`は既にCookieからのトークン読み取りに対応：

```typescript
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    let token: string | undefined;

    // Authorization headerから取得を試みる
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // ヘッダーにない場合、Cookieから取得
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;  // ✅ Cookieからも取得可能
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    // ...
  }
};
```

## 認証フローの変更

### Before（Bearer Token方式）
```
1. ログイン → サーバーがhttpOnly Cookieを設定
2. フロントエンドが上書きして7日間のCookieを設定（httpOnly失われる）
3. JavaScriptでCookieからトークンを取得
4. Authorization: Bearer <token> ヘッダーで送信
5. サーバーがトークンを検証
```

### After（Cookie方式）
```
1. ログイン → サーバーがhttpOnly Cookieを設定（30日間）
2. フロントエンドは何もしない
3. fetch時に credentials: 'include' を指定
4. ブラウザが自動的にCookieを送信
5. サーバーがCookieからトークンを取得して検証
```

## セキュリティの改善

### httpOnly Cookieのメリット
- ✅ XSS攻撃からトークンを保護
- ✅ JavaScriptからトークンにアクセス不可
- ✅ より安全な認証方式

### 今後の課題
- ⚠️ CSRF保護の実装（csrf-tokenなど）
- ⚠️ SameSite属性の設定検討

## テスト手順

### 1. ブラウザのCookieをクリア

**Chrome/Firefox:**
1. F12キーで開発者ツールを開く
2. Applicationタブ → Cookies → `http://localhost`
3. `token` Cookieを削除
4. ページをリロード（F5）

**または:**
```bash
# Chromeを完全に閉じて再起動
```

### 2. 再ログイン

1. http://localhost/staff/login にアクセス
2. ログイン情報を入力：
   - Email: `admin@facility.local`
   - Password: `admin123`
3. 「ログイン」ボタンをクリック

### 3. システム設定のテスト

1. ログイン後、システム設定画面に移動
2. サイト名を変更（例：「施設予約システムテスト」）
3. 「基本設定を保存」ボタンをクリック
4. **「基本設定を保存しました」というアラートが表示されればOK**
5. 別のページに移動して戻る
6. サイト名が変更されたまま表示されることを確認

### 4. その他の保存機能をテスト

以下の機能で保存が成功することを確認：
- ✅ 予約設定の保存
- ✅ メール設定の保存
- ✅ 営業時間の保存
- ✅ 施設の作成・編集
- ✅ 備品の作成・編集
- ✅ ユーザー情報の編集
- ✅ 職員情報の編集

### 5. トラブルシューティング

#### まだエラーが出る場合

**1. ハードリロード:**
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

**2. キャッシュをクリア:**
```
Windows/Linux: Ctrl + Shift + Delete
Mac: Cmd + Shift + Delete
```

**3. ブラウザのコンソールを確認:**
```
F12 → Console タブ
エラーメッセージを確認
```

**4. サーバーログを確認:**
```bash
docker-compose logs -f app
```

以下のログが出ているか確認：
```
[SystemSettingsController] updateBasicSettings called
[SystemSettingsController] User: { userId: 1, role: 'admin', ... }
[SystemSettings] Setting site_name = ...
[SystemSettings] Update result: { affectedRows: 1, ... }
```

#### 認証エラーが続く場合

**データベースでユーザーのロールを確認:**
```bash
docker-compose exec db mysql -u root -prootpassword facility_reservation

# SQLを実行
SELECT id, email, role, is_active FROM users WHERE email = 'admin@facility.local';

# roleが'admin'であることを確認
# もし違う場合:
UPDATE users SET role = 'admin' WHERE email = 'admin@facility.local';
```

## 影響範囲

### 修正されたファイル
1. `src/views/staff/login.ejs` - ログイン処理
2. `src/views/staff/settings.ejs` - システム設定画面

### 影響を受ける機能
- ✅ 職員ログイン
- ✅ システム設定の保存
- ✅ 全ての管理画面の保存機能

### 影響を受けない機能
- ✅ 一般利用者のログイン（別の実装）
- ✅ データの閲覧（保存以外の操作）
- ✅ 公開ページ

## 今後の対応

### 他の職員画面の確認

以下の画面でも同様の問題がないか確認：
- 施設管理画面（facilities.ejs）
- 備品管理画面（equipment.ejs）
- ユーザー管理画面（users.ejs）
- 予約管理画面（reservations.ejs）
- 職員管理画面（staff-management.ejs）

もし同様のエラーが出る場合は、同じ修正を適用します：
1. `const token = ...` を削除
2. `credentials: 'include'` を追加
3. `Authorization` header を削除

## 参考資料

### httpOnly Cookie
- https://developer.mozilla.org/ja/docs/Web/HTTP/Cookies#%E3%82%BB%E3%82%AD%E3%83%A5%E3%82%A2%E3%81%A8HttpOnly%E3%82%AF%E3%83%83%E3%82%AD%E3%83%BC

### credentials: 'include'
- https://developer.mozilla.org/ja/docs/Web/API/fetch#credentials

### CSRF対策
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

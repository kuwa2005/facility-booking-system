# CoreServer で Express/Node.js アプリを動かすノウハウ

## 前提知識

このサーバー（CoreServer: b45.coreserver.jp）は共有ホスティング環境で、Node.jsは**常駐サーバーとして実行できない**。Apacheが常駐し、Node.jsは**CGIモード**でしか実行できない。

---

## 1. Node.js インストール（NVM）

sudo権限がないため、ユーザー領域にNVMでインストール。

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm alias default 24
```

- node パス: `/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node`
- CGI環境では `PATH` が未設定 → **フルパス必須**
- `#!/usr/bin/env node` は **使えない**

---

## 2. CGIモードの基本パターン

### ファイル構成（2ファイル方式）

```
cgi-bin/
├── xxx.cgi    ← シェルラッパー（#!/bin/sh + exec node）
└── xxx.cjs    ← 実際のNode.jsロジック
```

### シェルラッパー (.cgi)

```sh
#!/bin/sh
exec /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node "$(dirname "$0")/xxx.cjs"
```

### CGI出力 (.cjs)

```js
const process = require('node:process');

// console.log() は使わない（Content-Typeが先に来ない）
process.stdout.write(
  'Content-Type: application/json; charset=utf-8\r\n' +
  'Content-Length: ' + Buffer.byteLength(json) + '\r\n' +
  'Cache-Control: no-cache\r\n' +
  '\r\n' +
  json
)
```

### .htaccess

```apache
Options +ExecCGI
AddHandler cgi-script .cgi

RewriteEngine On
RewriteRule ^api/status$ cgi-bin/status.cgi [L,QSA]
```

---

## 3. Express アプリをCGIモードで動かす（実践ノウハウ）

### 問題点

| 問題 | 原因 | 解決策 |
|------|------|--------|
| `Cannot convert undefined or null to object` | Express 4がasyncミドルウェアのエラーをキャッチしない | `Promise.resolve(fn(...)).catch(next)` でラップ |
| `malformed header from script` | `console.log()`出力がCGIヘッダーを壊す | `console.log = (...args) => process.stderr.write(...)` にリダイレクト |
| ポート競合 | `server.listen()` がCGIでも実行される | CGI専用エントリーポイント作成（listen不要） |
| DB接続プール枯渇 | リクエストごとにプロセス起動、プールが残る | CGI起動時に接続テストのみ、プールは使い捨てる |

### CGI Express アダプターパターン

```js
// cgi-bin/app.cjs
// 1. console出力をstderrにリダイレクト
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');

// 2. リクエストBodyをstdinから読む
function readBody() { /* Promise-based stdin reader */ }

// 3. CGI環境変数からreqオブジェクト構築
const req = {
  method: env.REQUEST_METHOD,
  url: parsedUrl.pathname + parsedUrl.search,
  headers: /* HTTP_* → lowercase */,
  cookies: /* Cookie パーサー */,
  body: /* POST/PUT のみ */,
};

// 4. Express appに渡す（モックresオブジェクト）
app(req, res, (err) => { /* エラーハンドリング */ });
```

### Express CGI用 モックresオブジェクトの必須メソッド

```js
res = {
  status(code),           // ステータスコード設定
  json(data),             // JSONレスポンス
  send(data),             // HTML/テキストレスポンス
  redirect(url),          // リダイレクト
  setHeader(name, value), // ヘッダー設定
  render(view, data),     // EJSテンプレートレンダリング
  sendFile(path),         // ファイル配信
  end(data),              // レスポンス終了
  locals: {},             // ビューに渡すローカル変数
}
```

---

## 4. .htaccess の書き方（全リクエストCGI化）

### 基本パターン

```apache
Options +ExecCGI
AddHandler cgi-script .cgi
RewriteEngine On

# 静的ファイルは直接配信（CGIに回さない）
RewriteCond %{REQUEST_URI} \.(ico|png|jpg|css|js|svg|woff|woff2)$ [NC]
RewriteRule ^ - [L]

# アップロードファイルも直接配信
RewriteCond %{REQUEST_URI} ^/uploads/
RewriteRule ^ - [L]

# 残りをすべてCGIに（PATH_INFO経由）
RewriteCond %{REQUEST_URI} !^/cgi-bin/
RewriteRule ^(.*)$ cgi-bin/app.cgi/$1 [L,QSA]
```

### 重要ポイント

- `RewriteRule ^(.*)$ cgi-bin/app.cgi/$1` の `/$1` で **PATH_INFO** にパスが渡される
- `RewriteCond %{REQUEST_URI} !^/cgi-bin/` で**無限ループ防止**
- `[L,QSA]` フラグ: 最後のルール + クエリ文字列を保持

---

## 5. EJSテンプレートのCGI対応

EJSは `res.render()` で使うが、CGIモードでは独自実装が必要。

```js
res.render = function(view, data) {
  const ejs = require('ejs');
  const viewsDir = path.join(__dirname, '..', 'src', 'views');
  const viewPath = path.join(viewsDir, view + '.ejs');
  const template = fs.readFileSync(viewPath, 'utf-8');
  const html = ejs.render(template, { ...res.locals, ...data }, {
    views: [viewsDir],
    filename: viewPath
  });
  res._chunks.push(Buffer.from(html, 'utf-8'));
  res._end();
};
```

---

## 6. データベース接続（CGIモード）

### 接続プールの問題

CGIモードではリクエストごとにプロセスが起動・終了する。コネクションプールは使い捨てになる。

```ts
// 通常モード: プール使用
export const pool = mysql.createPool(dbConfig);

// CGIモード: プールは使えるが、プロセス終了時に自動クローズ
// 明示的に closePool() を呼ぶ必要はない（プロセスが死ぬので）
```

### 推奨: CGI用initDb関数

```ts
async function initDb() {
  await testConnection();

  // マイグレーション済みチェック（information_schema利用）
  const [rows] = await pool.query(
    "SELECT COUNT(*) as cnt FROM information_schema.tables " +
    "WHERE table_schema = ? AND table_name = 'users'",
    [dbName]
  );
  if ((rows as any[])[0]?.cnt > 0) return; // 既に初期化済み

  await runMigrations(); // 初回のみ実行
}
```

---

## 7. 実際のデプロイ手順（施設予約システムの場合）

```bash
# 1. ファイルコピー
cp -r facility-booking-system/* /virtual/pcm/public_html/fbs.geo.jp/

# 2. .env作成（DB接続情報）
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=3306
DB_USER=pcm_fbs
DB_PASSWORD=bbCE
DB_NAME=pcm_fbs
JWT_SECRET=xxxxx
APP_URL=https://fbs.geo.jp
EOF

# 3. 依存関係インストール（本番モード）
npm install --omit=dev

# 4. bcrypt等のネイティブモジュール再ビルド
npm rebuild bcrypt
npm rebuild sharp

# 5. TypeScriptビルド
node node_modules/typescript/bin/tsc

# 6. マイグレーション実行
node dist/migrations/runner.js

# 7. CGIスクリプトに実行権限
chmod +x cgi-bin/*.cgi

# 8. アップロードディレクトリ作成
mkdir -p uploads
```

---

## 8. トラブルシューティング

### CGI が 500 Internal Server Error

```bash
# Apache エラーログ確認
tail -20 /usr/local/apache24/logs/error.log

# よくある原因:
# - node パス間違い → フルパスを使う
# - 実行権限なし → chmod +x
# - console.log() がヘッダーを壊す → stderrにリダイレクト
# - 無限リダイレクト → RewriteCond で cgi-bin/ を除外
```

### サイトが表示されない

```bash
# .htaccess の RewriteRule が無限ループしていないか
# RewriteCond %{REQUEST_URI} !^/cgi-bin/ を追加

# 静的ファイルが配信されない
# RewriteCond で .css/.js/.svg をスキップ
```

### データベース接続エラー

```bash
# DB接続テスト
mysql -u pcm_fbs -pbbCE -h localhost -P 3306 -e "SELECT 1"

# マイグレーション再実行
node dist/migrations/runner.js
```

---

## 9. Playwright セットアップ（root権限なし）

### 問題

`npx playwright install-deps` はsudo権限が必要。共有ホスティングでは使えない。

### 解決策: Ubuntuパッケージから共有ライブラリを手動取得

#### Step 1: Playwright と Chromium をインストール

```bash
cd /tmp && npm install playwright
npx playwright install chromium
```

#### Step 2: 不足している共有ライブラリを確認

```bash
ldd /virtual/pcm/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell 2>&1 | grep "not found"
```

以下のようなエラーが出る：
```
libnspr4.so => not found
libnss3.so => not found
libasound.so.2 => not found
libgbm.so.1 => not found
libatk-bridge-2.0.so.0 => not found
libatspi.so.0 => not found
libcairo.so.2 => not found
libdrm.so.2 => not found
libfontconfig.so.1 => not found
libglib-2.0.so.0 => not found
libpango-1.0.so.0 => not found
libxkbcommon.so.0 => not found
libwayland-server.so.0 => not found
libffi.so.7 => not found
libpcre.so.3 => not found
```

#### Step 3: Ubuntuパッケージからライブラリをダウンロード

**ポイント**: focal（20.04）パッケージはxz形式で展開可能。直接URLを指定してダウンロードする。

```bash
mkdir -p /tmp/libs && cd /tmp/libs

# === focal-updates からダウンロード ===
# Packages.xzから正しいパスを取得
PACKAGES=$(curl -sL "http://archive.ubuntu.com/ubuntu/dists/focal-updates/main/binary-amd64/Packages.xz" | xz -d)

for pkg in libnspr4 libnss3 libasound2 libdrm2 libglib2.0-0 libgdk-pixbuf2.0-0 libgbm1; do
  path=$(echo "$PACKAGES" | grep -A15 "^Package: ${pkg}$" | grep "Filename:" | tail -1 | awk '{print $2}')
  if [ -n "$path" ]; then
    echo "Downloading $pkg..."
    curl -sL -o "${pkg}.deb" "http://archive.ubuntu.com/ubuntu/$path"
  fi
done

# === focal-main からダウンロード（focal-updatesにないもの）===
PACKAGES_MAIN=$(curl -sL "http://archive.ubuntu.com/ubuntu/dists/focal/main/binary-amd64/Packages.xz" | xz -d)

for pkg in libatk-bridge2.0-0 libatspi2.0-0 libcairo2 libpango-1.0-0 libfontconfig1 libxkbcommon0; do
  path=$(echo "$PACKAGES_MAIN" | grep -A15 "^Package: ${pkg}$" | grep "Filename:" | tail -1 | awk '{print $2}')
  if [ -n "$path" ]; then
    echo "Downloading $pkg..."
    curl -sL -o "${pkg}.deb" "http://archive.ubuntu.com/ubuntu/$path"
  fi
done

# === 追加ライブラリ（直接URL指定）===
echo "Downloading libpcre3..."
curl -sL -o "libpcre3.deb" "http://archive.ubuntu.com/ubuntu/pool/main/p/pcre3/libpcre3_8.39-12ubuntu0.1_amd64.deb"

echo "Downloading libwayland-server0..."
curl -sL -o "libwayland.deb" "http://archive.ubuntu.com/ubuntu/pool/main/w/wayland/libwayland-server0_1.18.0-1ubuntu0.1_amd64.deb"

echo "Downloading libffi7..."
curl -sL -o "libffi7.deb" "http://archive.ubuntu.com/ubuntu/pool/main/libf/libffi/libffi7_3.3-4_amd64.deb"

# === ダウンロード確認 ===
echo "--- Downloaded packages ---"
for f in *.deb; do
  if file "$f" | grep -q "Debian binary"; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f (invalid)"
    rm -f "$f"
  fi
done
```

#### Step 4: パッケージを展開してライブラリを収集

```bash
# 展開先ディレクトリ作成
mkdir -p /virtual/pcm/.local/lib/playwright

for deb in *.deb; do
  echo "Extracting $deb..."
  tmpdir="tmp_${deb%.deb}"
  mkdir -p "$tmpdir" && cd "$tmpdir"
  ar x "../$deb" 2>/dev/null

  # focalパッケージはdata.tar.xz、bionicはdata.tar.xzまたはdata.tar.gz
  tar xf data.tar.xz 2>/dev/null || tar xf data.tar.gz 2>/dev/null

  # .soファイルをコピー
  find . -name "*.so*" \( -type f -o -type l \) -exec cp -Pn {} /virtual/pcm/.local/lib/playwright/ \; 2>/dev/null
  cd ..
done

echo "--- Collected libraries ---"
ls /virtual/pcm/.local/lib/playwright/*.so* 2>/dev/null | wc -l
```

#### Step 5: シンボリックリンクを再作成

`cp -Pn` はシンボリックリンクを複製すると实体ファイルとしてコピーしてしまうため、リンクを再作成する必要がある。

```bash
cd /virtual/pcm/.local/lib/playwright

# 実体ファイル名はバージョンにより異なる場合がある
# ls *.so.* で確認してからリンクを作成する
ln -sf libatk-bridge-2.0.so.0.0.0 libatk-bridge-2.0.so.0
ln -sf libatspi.so.0.0.1 libatspi.so.0
ln -sf libgbm.so.1.0.0 libgbm.so.1
ln -sf libasound.so.2.0.0 libasound.so.2
ln -sf libcairo.so.2.11600.0 libcairo.so.2
ln -sf libdrm.so.2.4.0 libdrm.so.2
ln -sf libfontconfig.so.1.12.0 libfontconfig.so.1
ln -sf libgdk_pixbuf-2.0.so.0.4000.0 libgdk_pixbuf-2.0.so.0
ln -sf libglib-2.0.so.0.6400.6 libglib-2.0.so.0
ln -sf libpango-1.0.so.0.4400.7 libpango-1.0.so.0
ln -sf libxkbcommon.so.0.0.0 libxkbcommon.so.0
ln -sf libwayland-server.so.0.1.0 libwayland-server.so.0
ln -sf libffi.so.7.1.0 libffi.so.7
```

#### Step 6: 動作確認

```bash
# Chromium起動テスト
LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright \
  /virtual/pcm/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell --version
# → "Google Chrome for Testing 151.0.7922.34" と表示されれば成功

# Playwrightテスト
cd /tmp && LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('Title:', await page.title());
  await browser.close();
})();
"
```

### 使い方

```bash
# 毎回 LD_LIBRARY_PATH を指定する必要がある
cd /tmp && LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright node test.js

# またはグローバルに設定（~/.bashrcに追加）
export LD_LIBRARY_PATH="/virtual/pcm/.local/lib/playwright:${LD_LIBRARY_PATH}"
```

### トラブルシューティング

| エラー | 原因 | 対処 |
|--------|------|------|
| `libXXX.so: cannot open shared object file` | ライブラリ未インストール | Step 3-5を実行 |
| `GLIBC_2.XX not found` | パッケージバージョン不一致 | focalパッケージを使用 |
| `Target page, context or browser has been closed` | CGIモードで接続切断 | テストごとに`browser.newPage()`を作成 |
| `End of script output before headers` | CGIスクリプトが異常終了 | `LD_LIBRARY_PATH`が設定されているか確認 |

---

## 10. このサーバーの制約まとめ

| 項目 | 状態 |
|------|------|
| sudo | 不可 |
| Apache設定変更 | 不可（.htaccess のみ可） |
| Node.js常駐 | 不可（CGIモードのみ） |
| pm2/forever | 使えない |
| NVM | ユーザー領域にインストール済み |
| PHP | fcgid（7.4.33） |
| データベース | MariaDB 10.6.24（localhost） |
| ドキュメントルート | `/virtual/pcm/public_html/<ドメイン>/` |

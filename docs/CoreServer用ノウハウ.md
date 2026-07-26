# CoreServer で Express/Node.js アプリを動かすノウハウ

> **対象環境**: CoreServer（b45.coreserver.jp）共有ホスティング
> **最終更新**: 2026-07-26
> **検証済み**: 施設予約システム（fbs.geo.jp）で動作確認済み

---

## 目次

1. [環境の制約](#1-環境の制約)
2. [Node.js インストール](#2-nodejs-インストール)
3. [CGIモードの基本](#3-cgimードの基本)
4. [Express をCGIで動かす](#4-express-をcgiで動かす)
5. [.htaccess 設定](#5-htaccess-設定)
6. [デプロイ手順](#6-デプロイ手順)
7. [Playwright セットアップ](#7-playwright-セットアップ)
8. [トラブルシューティング集](#8-トラブルシューティング集)
9. [このサーバーの制約一覧](#9-このサーバーの制約一覧)

---

## 1. 環境の制約

**最重要**: このサーバーではNode.jsを**常駐サーバーとして実行できない**。

| 項目 | 状態 | 備考 |
|------|------|------|
| sudo / root | **不可** | パッケージインストール不可 |
| Apache設定 | **不可** | `.htaccess` のみ変更可能 |
| Node.js常駐 | **不可** | `node server.js` は実行できない |
| pm2 / forever | **不可** | プロセス管理ツール使えない |
| NVM | **あり** | ユーザー領域にインストール済み |
| Node.js | v24.18.0 | NVMで管理 |
| PHP | 7.4.33 | fcgidモード |
| DB | MariaDB 10.6.24 | localhost接続 |
| ドキュメントルート | `/virtual/pcm/public_html/<ドメイン>/` | |

**結論**: Node.jsアプリは**CGIモード**で動作させる。

---

## 2. Node.js インストール

### 初回セットアップ

```bash
# NVMインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Node.jsインストール
nvm install 24
nvm alias default 24

# 確認
node -v  # v24.x.x
npm -v   # 11.x.x
```

### 重要: node のフルパス

NVMでインストールしたnodeはPATHに含まれない場合がある。**必ずフルパスを使う**。

```bash
# フルパス（pcmアカウントの場合）
/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node

# 確認方法
which node  # NVMが有効なら /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node
```

### CGI環境での注意

```bash
# ✗ 使えない
#!/usr/bin/env node
node server.js

# ○ 使うべき
#!/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node
/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node server.js
```

---

## 3. CGIモードの基本

### 仕組み

```
クライエント → Apache(.htaccess) → cgi-bin/app.cgi → Node.jsプロセス → Express → レスポンス
```

**ポイント**: リクエストごとにNode.jsプロセスが起動・終了する。常駐しない。

### ファイル構成（2ファイル方式）

```
cgi-bin/
├── app.cgi    ← シェルラッパー（Node.jsを起動するだけ）
└── app.cjs    ← 実際のNode.jsロジック
```

### シェルラッパー（app.cgi）

```sh
#!/bin/sh
exec /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node --max-old-space-size=256 "$(dirname "$0")/app.cjs"
```

- `#!/bin/sh` は必須（bashではない可能性がある）
- `--max-old-space-size=256` はメモリ制限（共有ホスティングでは重要）
- `$(dirname "$0")` で.cjsファイルのフルパスを取得

### CGI出力の書き方（app.cjs）

```js
const process = require('node:process');

// ✗ 使えない（Content-Typeが先に来ない → malformed header エラー）
console.log('{"status": "ok"}');

// ○ 使うべき
const json = JSON.stringify({ status: 'ok' });
process.stdout.write(
  'Content-Type: application/json; charset=utf-8\r\n' +
  'Content-Length: ' + Buffer.byteLength(json) + '\r\n' +
  '\r\n' +
  json
);
```

### CGI出力のフォーマット

```
Content-Type: text/html; charset=utf-8\r\n    ← ヘッダー
Content-Length: 123\r\n                         ← ヘッダー
\r\n                                           ← 空行（必須）
<html>...</html>                               ← ボディ
```

---

## 4. Express をCGIで動かす

### 必要な対応（3つ）

| # | 問題 | 解決策 |
|---|------|--------|
| 1 | `console.log` がCGIヘッダーを壊す | `console.log` を `process.stderr.write` にリダイレクト |
| 2 | asyncミドルウェアのエラーが無視される | `Promise.resolve(fn(...)).catch(next)` でラップ |
| 3 | `server.listen()` が実行される | CGI専用エントリーポイント作成（listen不要） |

### console出力のリダイレクト（必須）

```js
// app.cjs の先頭に追加
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write('[ERROR] ' + args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write('[WARN] ' + args.join(' ') + '\n');
```

**なぜ必要か**: Apacheは最初の行が `Content-Type:` でないとmalformed headerエラーになる。`console.log()` が出力するとヘッダーが壊れる。

### CGI専用エントリーポイント（cgi.ts）

```typescript
// src/cgi.ts
import express from 'express';
// ... ルートやミドルウェアのインポート

const app = express();
// ... Express設定（server.ts と同じ内容）
// ※ server.listen() は呼ばない

// マイグレーションスキップ（既に初期化済みの場合）
async function initDb() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) as cnt FROM information_schema.tables " +
    "WHERE table_schema = ? AND table_name = 'users'",
    [dbName]
  );
  if ((rows as any[])[0]?.cnt > 0) return; // 初期化済み
  await runMigrations(); // 初回のみ
}

export { app, initDb };
export default app;
```

### CGIハンドラ（cgi-bin/app.cjs）

```js
// 1. console出力をstderrにリダイレクト
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');

// 2. リクエストBodyをstdinから読む
function readBody() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

// 3. CGI環境変数からreqオブジェクト構築
const env = process.env;
const method = env.REQUEST_METHOD || 'GET';
const pathInfo = env.PATH_INFO || '/';
const host = env.HTTP_HOST || 'localhost';
// ... URL解析、ヘッダー変換

// 4. Express appに渡す
const app = require('../dist/cgi.js').default;
app(req, res, (err) => { /* エラーハンドリング */ });
```

### Express CGI用 res オブジェクトの必須メソッド

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

## 5. .htaccess 設定

### 完全な設定例

```apache
Options +ExecCGI
AddHandler cgi-script .cgi

RewriteEngine On

# 静的ファイルは直接配信（CGIに回さない）
RewriteCond %{REQUEST_URI} \.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|json|txt|xml)$ [NC]
RewriteRule ^ - [L]

# アップロードファイルも直接配信
RewriteCond %{REQUEST_URI} ^/uploads/
RewriteRule ^ - [L]

# 全リクエストをCGIに転送
# 重要: cgi-bin/ を除外しないと無限ループになる
RewriteCond %{REQUEST_URI} !^/cgi-bin/
RewriteRule ^(.*)$ cgi-bin/app.cgi/$1 [L,QSA]
```

### 各ルールの意味

| ルール | 意味 |
|--------|------|
| `RewriteCond %{REQUEST_URI} \.(css\|js...)$` | CSS/JS/画像はApache直接配信 |
| `RewriteCond %{REQUEST_URI} ^/uploads/` | アップロードファイルは直接配信 |
| `RewriteCond %{REQUEST_URI} !^/cgi-bin/` | **無限ループ防止**（必須） |
| `RewriteRule ^(.*)$ cgi-bin/app.cgi/$1` | 元のURLをPATH_INFOとして渡す |
| `[L,QSA]` | 最後のルール + クエリ文字列を保持 |

### 無限ループに注意

```apache
# ✗ 無限ループ（cgi-bin/ へのリクエストもルーティングしてしまう）
RewriteRule ^(.*)$ cgi-bin/app.cgi/$1 [L,QSA]

# ○ 無限ループしない（cgi-bin/ を除外）
RewriteCond %{REQUEST_URI} !^/cgi-bin/
RewriteRule ^(.*)$ cgi-bin/app.cgi/$1 [L,QSA]
```

---

## 6. デプロイ手順

### Step 1: ファイルをデプロイ先にコピー

```bash
cd /path/to/project
cp -r * /virtual/pcm/public_html/<ドメイン>/
```

### Step 2: .env ファイル作成

```bash
cat > /virtual/pcm/public_html/<ドメイン>/.env << 'EOF'
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=<DBユーザー名>
DB_PASSWORD=<DBパスワード>
DB_NAME=<DB名>
JWT_SECRET=<ランダムな文字列>
APP_URL=https://<ドメイン>
EOF
```

### Step 3: 依存関係インストール

```bash
cd /virtual/pcm/public_html/<ドメイン>

# 本番モードでインストール（devDependencies をスキップ）
npm install --omit=dev

# メモリ不足で失敗する場合
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev
```

### Step 4: ネイティブモジュール再ビルド

```bash
# bcrypt（パスワードハッシュに必要）
npm rebuild bcrypt

# sharp（画像処理に必要）
npm rebuild sharp
```

**なぜ再ビルドが必要か**: `npm install` は現在のnodeバージョン用のバイナリをダウンロードするが、失敗することがある。`npm rebuild` で強制的に再コンパイルする。

### Step 5: TypeScriptビルド

```bash
# tsc をローカルから実行（npx tsc は使えない場合がある）
node node_modules/typescript/bin/tsc
```

**なぜ `npx tsc` が使えない場合があるか**: `npx` はグローバルにインストールされたパッケージを探すが、共有ホスティングでは設定が異なる場合がある。

### Step 6: マイグレーション実行

```bash
node dist/migrations/runner.js
```

### Step 7: CGIスクリプトに実行権限

```bash
chmod +x cgi-bin/*.cgi
```

### Step 8: アップロードディレクトリ作成

```bash
mkdir -p uploads
```

### Step 9: 動作確認

```bash
# ヘルスチェック
curl -s -o /dev/null -w "%{http_code}" https://<ドメイン>/health
# → 200 なら成功

# トップページ
curl -s https://<ドメイン>/ | grep "<title>"
# → タイトルが表示されれば成功
```

---

## 7. Playwright セットアップ

### 問題

`npx playwright install-deps` はsudo権限が必要。共有ホスティングでは使えない。

### 解決策

Ubuntuパッケージから共有ライブラリを手動でダウンロードする。

### Step 1: Playwright と Chromium をインストール

```bash
cd /tmp && npm install playwright
npx playwright install chromium
```

### Step 2: 不足しているライブラリを確認

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

### Step 3: Ubuntuパッケージからライブラリをダウンロード

```bash
mkdir -p /tmp/libs && cd /tmp/libs

# === focal-updates からダウンロード ===
PACKAGES=$(curl -sL "http://archive.ubuntu.com/ubuntu/dists/focal-updates/main/binary-amd64/Packages.xz" | xz -d)

for pkg in libnspr4 libnss3 libasound2 libdrm2 libglib2.0-0 libgdk-pixbuf2.0-0 libgbm1; do
  path=$(echo "$PACKAGES" | grep -A15 "^Package: ${pkg}$" | grep "Filename:" | tail -1 | awk '{print $2}')
  if [ -n "$path" ]; then
    echo "Downloading $pkg..."
    curl -sL -o "${pkg}.deb" "http://archive.ubuntu.com/ubuntu/$path"
  fi
done

# === focal-main からダウンロード ===
PACKAGES_MAIN=$(curl -sL "http://archive.ubuntu.com/ubuntu/dists/focal/main/binary-amd64/Packages.xz" | xz -d)

for pkg in libatk-bridge2.0-0 libatspi2.0-0 libcairo2 libpango-1.0-0 libfontconfig1 libxkbcommon0; do
  path=$(echo "$PACKAGES_MAIN" | grep -A15 "^Package: ${pkg}$" | grep "Filename:" | tail -1 | awk '{print $2}')
  if [ -n "$path" ]; then
    echo "Downloading $pkg..."
    curl -sL -o "${pkg}.deb" "http://archive.ubuntu.com/ubuntu/$path"
  fi
done

# === 追加ライブラリ（直接URL指定）===
curl -sL -o "libpcre3.deb" "http://archive.ubuntu.com/ubuntu/pool/main/p/pcre3/libpcre3_8.39-12ubuntu0.1_amd64.deb"
curl -sL -o "libwayland.deb" "http://archive.ubuntu.com/ubuntu/pool/main/w/wayland/libwayland-server0_1.18.0-1ubuntu0.1_amd64.deb"
curl -sL -o "libffi7.deb" "http://archive.ubuntu.com/ubuntu/pool/main/libf/libffi/libffi7_3.3-4_amd64.deb"

# === ダウンロード確認 ===
for f in *.deb; do
  if file "$f" | grep -q "Debian binary"; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f (invalid - removing)"
    rm -f "$f"
  fi
done
```

### Step 4: パッケージを展開してライブラリを収集

```bash
mkdir -p /virtual/pcm/.local/lib/playwright

for deb in *.deb; do
  echo "Extracting $deb..."
  tmpdir="tmp_${deb%.deb}"
  mkdir -p "$tmpdir" && cd "$tmpdir"
  ar x "../$deb" 2>/dev/null
  tar xf data.tar.xz 2>/dev/null || tar xf data.tar.gz 2>/dev/null
  find . -name "*.so*" \( -type f -o -type l \) -exec cp -Pn {} /virtual/pcm/.local/lib/playwright/ \; 2>/dev/null
  cd ..
done

echo "Collected: $(ls /virtual/pcm/.local/lib/playwright/*.so* 2>/dev/null | wc -l) libraries"
```

### Step 5: シンボリックリンクを再作成

`cp -Pn` はシンボリックリンクを実体ファイルとしてコピーしてしまう。リンクを再作成する。

```bash
cd /virtual/pcm/.local/lib/playwright

# ls で実体ファイル名を確認してからリンクを作成
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

### Step 6: 動作確認

```bash
NODE=/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node

# Chromium起動テスト
LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright \
  /virtual/pcm/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell --version
# → "Google Chrome for Testing 151.0.7922.34" と表示されれば成功

# Playwrightテスト
cd /tmp && LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright $NODE -e "
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
NODE=/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node

# 毎回 LD_LIBRARY_PATH を指定
cd /tmp && LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright $NODE test.js

# ~/.bashrc に追加して省略可能
export LD_LIBRARY_PATH="/virtual/pcm/.local/lib/playwright:${LD_LIBRARY_PATH}"
alias node='/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node'
```

---

## 8. トラブルシューティング集

### CGI が 500 Internal Server Error を返す

```bash
# Apacheエラーログ確認
tail -20 /usr/local/apache24/logs/error.log

# よくある原因と対処:
```

| エラーメッセージ | 原因 | 対処 |
|------------------|------|------|
| `exec: node: not found` | nodeパス間違い | フルパスを使う |
| `Permission denied` | 実行権限なし | `chmod +x cgi-bin/*.cgi` |
| `malformed header from script` | console.log出力 | stderrにリダイレクト |
| `Request exceeded the limit of 10 internal redirects` | 無限ループ | `RewriteCond %{REQUEST_URI} !^/cgi-bin/` を追加 |
| `Cannot convert undefined or null to object` | asyncミドルウェアエラー | `Promise.resolve().catch(next)` でラップ |

### サイトが表示されない

```bash
# 1. CGIスクリプトが実行できるか確認
cd /virtual/pcm/public_html/<ドメイン>
REQUEST_METHOD=GET PATH_INFO=/health HTTP_HOST=<ドメイン> \
  /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node cgi-bin/app.cjs

# 2. .htaccess の RewriteRule を確認
# 無限ループしていないか、cgi-bin/ を除外しているか
```

### データベース接続エラー

```bash
# DB接続テスト
mysql -u <ユーザー名> -p<パスワード> -h localhost -e "SELECT 1"

# マイグレーション再実行
node dist/migrations/runner.js
```

### npm install が失敗する

```bash
# メモリ不足の場合
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev

# それでも失敗する場合
rm -rf node_modules package-lock.json
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev
```

### Playwright が動かない

```bash
# ライブラリが足りない場合
ldd /virtual/pcm/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell 2>&1 | grep "not found"

# 対処: Section 7 の Step 3-5 を実行
```

---

## 9. このサーバーの制約一覧

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| 1 | sudo / root | 不可 | パッケージインストール不可 |
| 2 | Apache設定変更 | 不可 | `.htaccess` のみ変更可能 |
| 3 | Node.js常駐 | 不可 | CGIモードのみ |
| 4 | pm2 / forever | 不可 | プロセス管理ツール使えない |
| 5 | NVM | あり | ユーザー領域にインストール済み |
| 6 | node パス | `/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node` | CGIではフルパス必須 |
| 7 | PHP | fcgid（7.4.33） | 動作確認済み |
| 8 | DB | MariaDB 10.6.24 | localhost接続 |
| 9 | ドキュメントルート | `/virtual/pcm/public_html/<ドメイン>/` | |
| 10 | GLIBC | 2.28 | Chromium Headless Shell対応済み |
| 11 | .htaccess | AllowOverride 有効 | 変更は即反映 |
| 12 | Apacheログ | `/usr/local/apache24/logs/error.log` | トラブル時確認 |

---

## 付録: 過去に踏んだ罠まとめ

| # | 罠 | 解決策 |
|---|-----|--------|
| 1 | `#!/usr/bin/env node` が使えない | シェルラッパーでフルパス指定 |
| 2 | `console.log()` がCGIヘッダーを壊す | stderrにリダイレクト |
| 3 | Express 4がasyncミドルウェアのエラーを無視 | `Promise.resolve().catch(next)` でラップ |
| 4 | `server.listen()` がCGIでも実行される | CGI専用エントリーポイント作成 |
| 5 | RewriteRule で無限ループ | `RewriteCond %{REQUEST_URI} !^/cgi-bin/` |
| 6 | PATH_INFO が渡されない | `RewriteRule ^(.*)$ cgi-bin/app.cgi/$1` の `/$1` |
| 7 | cp -Pn でシンボリックリンクが切れる | 手動でリンクを再作成 |
| 8 | focalパッケージのURL取得で404 | Packages.xzから正しいパスを取得 |
| 9 | GLIBC_2.29 not found | focalパッケージ（GLIBC 2.28対応）を使用 |
| 10 | npm install がメモリ不足で失敗 | `NODE_OPTIONS="--max-old-space-size=512"` |

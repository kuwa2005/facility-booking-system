# CGIモードデプロイガイド

共有ホスティング環境（CoreServer等）でNode.jsをCGIモードとして実行するためのガイドです。

## 概要

このサーバーではNode.jsを常駐サーバーとして実行できないため、Apache CGIモードでリクエストごとにプロセスを起動する方式を採用しています。

```
クライエント → Apache → cgi-bin/app.cgi → Node.jsプロセス → Express → レスポンス
```

## 必要な環境

- **Webサーバー**: Apache 2.4+（mod_rewrite, mod_cgi 有効）
- **Node.js**: v20+（NVMでインストール推奨）
- **データベース**: MySQL 8.0+ / MariaDB 10.11+
- **権限**: .htaccess での設定変更が可能（AllowOverride 有効）

## セットアップ手順

### 1. Node.js インストール（NVM使用）

```bash
# NVMインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Node.jsインストール
nvm install 24
nvm alias default 24

# 確認
node -v  # v24.x.x
```

### 2. プロジェクトセットアップ

```bash
cd /path/to/document/root/

# 1. 依存関係インストール
npm install --omit=dev

# 2. ネイティブモジュール再ビルド
npm rebuild bcrypt
npm rebuild sharp

# 3. TypeScriptビルド
node node_modules/typescript/bin/tsc

# 4. 環境変数設定
cp .env.example .env
# .env を編集（DB接続情報等）

# 5. マイグレーション実行（初回のみ）
node dist/migrations/runner.js

# 6. CGIスクリプトに実行権限
chmod +x cgi-bin/*.cgi

# 7. アップロードディレクトリ作成
mkdir -p uploads
```

### 3. .htaccess 設定

プロジェクトルートに `.htaccess` を配置：

```apache
Options +ExecCGI
AddHandler cgi-script .cgi

RewriteEngine On

# 静的ファイルは直接配信
RewriteCond %{REQUEST_URI} \.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|json|txt|xml)$ [NC]
RewriteRule ^ - [L]

# アップロードファイルは直接配信
RewriteCond %{REQUEST_URI} ^/uploads/
RewriteRule ^ - [L]

# 全リクエストをCGIに転送（無限ループ防止付き）
RewriteCond %{REQUEST_URI} !^/cgi-bin/
RewriteRule ^(.*)$ cgi-bin/app.cgi/$1 [L,QSA]
```

## ファイル構成

```
document-root/
├── .htaccess              # Apache URLルーティング設定
├── .env                   # 環境変数（DB接続情報等）
├── cgi-bin/
│   ├── app.cgi            # シェルラッパー（Node.js起動用）
│   └── app.cjs            # CGIハンドラ（リクエスト処理）
├── src/
│   ├── cgi.ts             # CGIエントリーポイント（Express定義）
│   ├── server.ts          # 通常モード用サーバー（CGIでは未使用）
│   ├── routes/            # API・ページルート
│   ├── services/          # ビジネスロジック
│   ├── controllers/       # リクエストハンドラ
│   ├── views/             # EJSテンプレート
│   └── ...
├── dist/                  # TypeScriptビルド成果物
├── migrations/            # DBマイグレーション
├── public/                # 静的ファイル
└── uploads/               # アップロードファイル
```

## CGI動作の仕組み

### 1. リクエスト処理フロー

1. Apacheがリクエストを受信
2. `.htaccess` の RewriteRule で `cgi-bin/app.cgi` に転送
3. `app.cgi` がNode.jsプロセスを起動
4. `app.cjs` がCGI環境変数からリクエスト情報を構築
5. Expressアプリにリクエストを渡して処理
6. レスポンスをCGI形式で出力

### 2. 重要な制約

| 制約 | 対応策 |
|------|--------|
| `console.log()` がCGIヘッダーを壊す | `console.log` を `process.stderr.write` にリダイレクト |
| asyncミドルウェアのエラーが無視される | `Promise.resolve().catch(next)` でラップ |
| リクエストごとにプロセス起動 | 起動オーバーヘッドが発生（やむを得ない） |
| `#!/usr/bin/env node` が使えない | シェルラッパーでフルパス指定 |
| EJSテンプレートのレンダリング | CGIハンドラ内で `ejs` モジュールを直接利用 |

### 3. CGIハンドラのポイント

```js
// console出力をstderrにリダイレクト（必須）
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');

// リクエストBodyをstdinから読む
function readBody() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// CGI環境変数からreqオブジェクト構築
const req = {
  method: env.REQUEST_METHOD,
  url: parsedUrl.pathname + parsedUrl.search,
  headers: /* HTTP_* → lowercase変換 */,
  cookies: /* Cookie パーサー */,
  body: /* POST/PUT のみ */,
};

// レスポンスをCGI形式で出力
process.stdout.write(
  'Status: 200\r\n' +
  'Content-Type: text/html; charset=utf-8\r\n' +
  'Content-Length: ' + body.length + '\r\n' +
  '\r\n' + body
);
```

## トラブルシューティング

### CGI が 500 Internal Server Error を返す

```bash
# Apacheエラーログ確認
tail -20 /usr/local/apache24/logs/error.log

# よくある原因と対処:
# 1. node パス間違い → フルパスを使う
#    /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node

# 2. 実行権限なし
chmod +x cgi-bin/*.cgi

# 3. console.log() がヘッダーを壊す
# → stderrにリダイレクト

# 4. 無限リダイレクト
# → RewriteCond %{REQUEST_URI} !^/cgi-bin/ を追加
```

### ページが表示されない

```bash
# ビルド済みか確認
ls dist/server.js

# TypeScript再ビルド
node node_modules/typescript/bin/tsc
```

### データベース接続エラー

```bash
# DB接続テスト
mysql -u <user> -p<password> -h localhost -e "SELECT 1"

# マイグレーション再実行
node dist/migrations/runner.js
```

## パフォーマンス

CGIモードではリクエストごとにNode.jsプロセスが起動するため、常駐サーバーに比べて遅いです。対策：

1. **静的ファイルの直接配信**: `.htaccess` でCSS/JS/画像をスキップ
2. **gzip圧縮**: Apacheの `mod_deflate` を有効化
3. **ブラウザキャッシュ**: `Cache-Control` ヘッダーの設定

## 参考

- [Express CGI アダプターパターン](../cgi-bin/app.cjs)
- [CoreServer用ノウハウ](./CoreServer用ノウハウ.md)

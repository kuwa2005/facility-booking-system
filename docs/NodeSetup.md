# Node.js セットアップガイド（CoreServer共有ホスティング）

> **対象環境**: CoreServer（AlmaLinux 8 / GLIBC 2.28）共有ホスティング
> **最終更新**: 2026-07-27

---

## 1. 環境情報

| 項目 | 値 |
|------|-----|
| OS | AlmaLinux 8.10 (GLIBC 2.28) |
| アカウント | pcm |
| Node.js | v24.18.0（NVM使用） |
| Nodeパス | `/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node` |
| npmパス | `/virtual/pcm/.nvm/versions/node/v24.18.0/bin/npm` |

---

## 2. Node.js インストール（NVM使用）

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

---

## 3. CGIモードデプロイ手順

共有ホスティングではNode.jsを常駐サーバーとして実行できないため、Apache CGIモードでリクエストごとにプロセスを起動する。

### 3.1 初回デプロイ

```bash
DEPLOY_DIR=/virtual/pcm/public_html/example.com

# 1. ファイルコピー
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='uploads' \
  /path/to/source/ $DEPLOY_DIR/

# 2. .env作成
cat > $DEPLOY_DIR/.env << 'EOF'
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=<ランダムな文字列>
APP_URL=https://example.com
EOF

# 3. 依存関係インストール（メモリ制限対策必須）
cd $DEPLOY_DIR
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev

# 4. ネイティブモジュール再ビルド
npm rebuild bcrypt
npm rebuild sharp

# 5. TypeScriptビルド
NODE_OPTIONS="--max-old-space-size=512" node node_modules/typescript/bin/tsc

# 6. viewsをdistにコピー（tscはコピーしない）
cp -r src/views dist/

# 7. マイグレーション実行（初回のみ）
node dist/migrations/runner.js

# 8. CGIスクリプトに実行権限
chmod +x cgi-bin/*.cgi

# 9. uploadsディレクトリ作成
mkdir -p uploads
```

### 3.2 更新デプロイ

```bash
cd $DEPLOY_DIR

# ファイル更新
cp -r /path/to/source/src .
cp -r /path/to/source/cgi-bin .

# ビルド
NODE_OPTIONS="--max-old-space-size=512" node node_modules/typescript/bin/tsc
cp -r src/views dist/

# CGIモードなのでサーバー再起動不要、即反映
```

---

## 4. 重要な制約

### 4.1 パスの扱い

- `node` コマンドは `PATH` に含まれない → **必ずフルパス使用**
- `npx` も使えない場合がある → `node node_modules/typescript/bin/tsc` のように直接実行
- `#!/usr/bin/env node` はCGI環境で使えない → シェルラッパーでフルパス指定

### 4.2 メモリ制限

- `npm install` がメモリ不足で失敗する → `NODE_OPTIONS="--max-old-space-size=512"` が必須
- `npm rebuild` も同様にメモリ不足の可能性あり
- CGIスクリプトでも `--max-old-space-size=256` を設定

### 4.3 CGIモードの制約

- **Node.jsは常駐できない**: リクエストごとにプロセス起動・終了
- **`console.log()`が使えない**: CGIヘッダーを壊すためstderrにリダイレクト
- **express.json()が使えない**: CGI用ボディパーサーを自作
- **viewsがdistにない**: `cp -r src/views dist/` が手動で必要

### 4.4 /tmp の取扱い

> **共有レンタルサーバーのため、/tmp にファイルを残すのは禁止。**
> 一時作業用に使う分には構わないが、恒久的に使用してはならない。
> ライブラリやツールは `~/.local/` 配下に配置すること。

---

## 5. .htaccess 設定例

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

---

## 6. トラブルシューティング

### 6.1 500エラー

```bash
tail -20 /usr/local/apache24/logs/error.log
```

### 6.2 npm install がメモリ不足で失敗

```bash
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev
```

### 6.3 パスワードハッシュが不正

```bash
# ハッシュ再生成
node -e "require('bcrypt').hash('admin123', 10).then(h => console.log(h))"

# DB更新
mysql -u <user> -p<pass> -h localhost <db> \
  -e "UPDATE users SET password_hash='<hash>' WHERE email='admin@example.com'"
```

### 6.4 TypeScriptビルド後のEJSテンプレートが見つからない

```bash
# viewsをdistにコピー（tscはコピーしない）
cp -r src/views dist/
```

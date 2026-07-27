# Playwright セットアップガイド（CoreServer共有ホスティング）

> **対象環境**: CoreServer（AlmaLinux 8 / GLIBC 2.28）共有ホスティング
> **最終更新**: 2026-07-27

---

## 1. 概要

共有ホスティング環境では `npx playwright install-deps` が使えない（sudo必要）ため、
共有ライブラリとChromiumを手動でセットアップする。

---

## 2. ディレクトリ構成

```
~/
├── .nvm/versions/node/v24.18.0/     # Node.js（NVM管理）
├── .local/
│   ├── bin/
│   │   └── certutil                 # NSS DB管理ツール
│   ├── lib/
│   │   ├── node_modules/
│   │   │   └── playwright/          # Playwright npmモジュール
│   │   └── playwright/              # Chromium用共有ライブラリ
│   │       ├── libfreebl3.so        # NSS暗号ベースモジュール（重要）
│   │       ├── libfreeblpriv3.so    # プライベート暗号モジュール
│   │       ├── libsoftokn3.so       # NSS PKCS#11ラッパー
│   │       ├── libnss3.so           # NSSコア
│   │       ├── libnspr4.so          # NSSプラットフォームランタイム
│   │       ├── libnssutil3.so       # NSSユーティリティ
│   │       ├── libatk-bridge-2.0.so.0
│   │       ├── libatspi.so.0
│   │       ├── libasound.so.2
│   │       ├── libdrm.so.2
│   │       ├── libgbm.so.1
│   │       └── libwayland-server.so.0
│   └── share/
│       └── pki/
│           └── nssdb/               # NSS証明書データベース
│               ├── cert9.db         # 証明書DB（certutilで自動生成）
│               ├── key4.db          # 秘密鍵DB（certutilで自動生成）
│               └── pkcs11.txt       # PKCS#11モジュール設定
├── .cache/
│   └── ms-playwright/               # Chromiumバイナリキャッシュ
│       ├── chromium-1234/
│       └── chromium_headless_shell-1234/
```

---

## 3. Playwrightインストール

### 3.1 npmモジュール

```bash
NODE=/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node

$NODE -g install playwright 2>&1
```

### 3.2 Chromium ダウンロード

```bash
NODE_PATH=/virtual/pcm/.nvm/versions/node/v24.18.0/lib/node_modules \
  /virtual/pcm/.nvm/versions/node/v24.18.0/bin/npx playwright install chromium
```

---

## 4. 共有ライブラリのセットアップ

### 4.1 必要なライブラリ一覧

| パッケージ | 提供ライブラリ | 用途 |
|-----------|---------------|------|
| nspr | `libnspr4.so`, `libplc4.so`, `libplds4.so` | プラットフォームランタイム |
| nss | `libnss3.so`, `libnssutil3.so`, `libsmime3.so`, `libssl3.so` | SSL/TLS・証明書 |
| nss-softokn | `libsoftokn3.so`, `libnssdbm3.so` | PKCS#11ラッパー |
| nss-softokn-freebl | **`libfreebl3.so`**, `libfreeblpriv3.so` | ** NSS暗号ベース（必须） ** |
| atk | `libatk-1.0.so.0`, `libatk-bridge-2.0.so.0` | アクセシビリティ |
| at-spi2-core | `libatspi.so.0` | アクセシビリティ |
| at-spi2-atk | (atk依存) | アクセシビリティ |
| alsa-lib | `libasound.so.2` | オーディオ |
| libdrm | `libdrm.so.2` | DRM |
| mesa-libgbm | `libgbm.so.1` | グラフィック |
| libwayland-server | `libwayland-server.so.0` | Wayland |

### 4.2 セットアップ手順

> **重要**: `/tmp` にファイルを残さないこと。一時作業後に必ず削除すること。
> ライブラリはすべて `~/.local/lib/playwright/` に配置すること。

```bash
PLAYWRIGHT_LIB=~/.local/lib/playwright
mkdir -p $PLAYWRIGHT_LIB

# --- ライブラリをRPMから取得して展開 ---
# yumdownloaderは/tmpにダウンロードするが、処理後に削除する
cd /tmp

yumdownloader --disablerepo='pgdg*' --destdir=/tmp/pkgs \
  nspr nss nss-util nss-softokn nss-softokn-freebl \
  atk at-spi2-atk at-spi2-core alsa-lib libdrm libwayland-server \
  mesa-libgbm

# 全RPMを展開
mkdir -p /tmp/extract
for rpm in /tmp/pkgs/*x86_64.rpm; do
  rpm2cpio "$rpm" | cpio -idmv --directory=/tmp/extract 2>/dev/null
done

# ライブラリをコピー
cp /tmp/extract/usr/lib64/*.so* $PLAYWRIGHT_LIB/

# 一時ファイルを削除（必須）
rm -rf /tmp/pkgs /tmp/extract
```

### 4.3 NSS DBの初期化（HTTPS接続に必要）

> **これはHTTPS接続に必須。省略するとChromiumがクラッシュする。**

```bash
# certutilを取得
cd /tmp
yumdownloader --disablerepo='pgdg*' --destdir=/tmp nss-tools
rpm2cpio /tmp/nss-tools*x86_64.rpm | cpio -idmv 2>/dev/null
mkdir -p ~/.local/bin
cp /tmp/usr/bin/certutil ~/.local/bin/
rm -rf /tmp/nss-tools /tmp/usr  # 一時ファイル削除（必須）

# NSS DBを初期化
LD_LIBRARY_PATH=~/.local/lib/playwright \
  ~/.local/bin/certutil -d sql:~/.local/share/pki/nssdb -N --empty-password
```

---

## 5. 動作確認

### 5.1 共有ライブラリの不足確認

```bash
LD_LIBRARY_PATH=~/.local/lib/playwright \
  ldd ~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
  2>&1 | grep "not found"

# → 出力がなければOK
```

### 5.2 HTTPS接続テスト

```bash
LD_LIBRARY_PATH=~/.local/lib/playwright \
  ~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
  --no-sandbox --headless --dump-dom https://example.com 2>/dev/null | head -5
```

### 5.3 Node.jsからPlaywright使用

```bash
NODE_PATH=/virtual/pcm/.nvm/versions/node/v24.18.0/lib/node_modules \
LD_LIBRARY_PATH=/virtual/pcm/.local/lib/playwright \
/virtual/pcm/.nvm/versions/node/v24.18.0/bin/node << 'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://example.com', { timeout: 15000 });
  console.log('Title:', await page.title());
  await browser.close();
})();
EOF
```

---

## 6. 環境変数まとめ

Playwright を実行する際は必ず以下の環境変数を設定すること：

| 環境変数 | 値 | 用途 |
|----------|-----|------|
| `NODE_PATH` | `/virtual/pcm/.nvm/versions/node/v24.18.0/lib/node_modules` | グローバルnpmモジュールの検索パス |
| `LD_LIBRARY_PATH` | `/virtual/pcm/.local/lib/playwright` | Chromium用共有ライブラリの検索パス |

---

## 7. トラブルシューティング

### 7.1 HTTPS接続でChromiumがクラッシュ

```
FATAL:crypto/nss_util.cc:146] nss_error=-8023, os_error=0
```

**原因**: `libfreebl3.so` が不足し、NSSが初期化できない。

**解決**:
```bash
# libfreebl3.soを取得
cd /tmp && yumdownloader --disablerepo='pgdg*' --destdir=/tmp nss-softokn-freebl
rpm2cpio /tmp/nss-softokn-freebl*x86_64.rpm | cpio -idmv 2>/dev/null
cp /tmp/usr/lib64/libfreebl3.so ~/.local/lib/playwright/
cp /tmp/usr/lib64/libfreeblpriv3.so ~/.local/lib/playwright/
rm -rf /tmp/nss-softokn-freebl* /tmp/usr  # 一時ファイル削除（必須）

# NSS DBを初期化
LD_LIBRARY_PATH=~/.local/lib/playwright \
  ~/.local/bin/certutil -d sql:~/.local/share/pki/nssdb -N --empty-password
```

### 7.2 共有ライブラリの不足

```
error while loading shared libraries: libXXX.so: cannot open shared object file
```

**解決**:
```bash
# 不足ライブラリのRPMパッケージ名を確認
yumdownloader --disablerepo='pgdg*' --destdir=/tmp <package-name>
cd /tmp && rpm2cpio <package>*x86_64.rpm | cpio -idmv 2>/dev/null
cp /tmp/usr/lib64/libXXX.so* ~/.local/lib/playwright/
rm -rf /tmp/<package>* /tmp/usr  # 一時ファイル削除（必須）
```

### 7.3 HTTPは動作するがHTTPSだけ失敗

→ NSS DB未初期化が原因。上記7.1の手順で対応。

### 7.4 Chromium起動エラー

```bash
# 完全なエラーログを確認
LD_LIBRARY_PATH=~/.local/lib/playwright \
  ~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
  --no-sandbox --headless --dump-dom https://example.com 2>&1
```

---

## 8. /tmp の取扱いに関する注意

> **共有レンタルサーバーのため、/tmp にファイルを残すのは禁止。**

- `yumdownloader` や `rpm2cpio` の一時ファイルは `/tmp` に展開されるが、
  コピー後に**必ず削除**すること
- ライブラリやツールは `~/.local/` 配下に配置すること
- PlaywrightのChromiumプロセスが一時ファイルを `/tmp` に作成することがあるが、
  これはプロセス終了後に自動削除される
- 恒久的な保存先として `/tmp` を使用してはならない

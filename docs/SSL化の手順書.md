# SSL化の手順書

## 概要

このドキュメントは、施設予約システムにSSL/TLS（HTTPS）を導入するための手順書です。

### 環境情報
- **ドメイン**: home.docomo2.com（DDNS）
- **HTTPポート**: 18080
- **HTTPSポート**: 18443
- **環境**: Docker Compose
- **Webサーバー**: Nginx
- **特記事項**: グローバルIPアドレスが動的に変化する環境

---

## 目次

1. [SSL証明書について](#ssl証明書について)
2. [Let's Encryptによる証明書取得](#lets-encryptによる証明書取得)
3. [Nginx設定の変更](#nginx設定の変更)
4. [Docker Compose設定の変更](#docker-compose設定の変更)
5. [証明書の自動更新設定](#証明書の自動更新設定)
6. [開発環境での設定](#開発環境での設定)
7. [トラブルシューティング](#トラブルシューティング)
8. [セキュリティ推奨事項](#セキュリティ推奨事項)

---

## SSL証明書について

### Q1: ポート18080/18443で運用する場合の注意点

**回答**: Let's Encryptの標準的なHTTP-01チャレンジは**ポート80へのアクセスが必須**です。そのため、ポート18080/18443で運用する場合は以下の方法があります：

#### 方法1: DNS-01チャレンジを使用（推奨）

DNS-01チャレンジはDNSレコードで認証を行うため、ポート80/443を開ける必要がありません。

**メリット**:
- ポート80/443を開ける必要がない
- ファイアウォールの設定変更不要
- より安全

**デメリット**:
- 手動でDNSレコードを追加する必要がある
- 自動更新には別途設定が必要

#### 方法2: 一時的にポート80/443を開けて証明書取得

証明書取得時のみポート80を使用し、取得後は18080/18443で運用します。

### Q2: DDNSでIPアドレスが変わっても証明書は有効か？

**回答**: **はい、問題ありません**

SSL証明書は**ドメイン名**に対して発行されるため、IPアドレスが変更されても証明書の有効性には影響しません。

**仕組み**:
1. クライアント（ブラウザ）が `https://home.docomo2.com:18443` にアクセス
2. DDNSサービスが最新のグローバルIPアドレスを返す
3. そのIPアドレスのサーバーに接続
4. サーバーから受け取った証明書のドメイン名（home.docomo2.com）が一致すれば検証成功

**重要**: DDNSクライアントが常に最新のIPアドレスを登録し続けることが必須です。

### Q3: 開発環境でhostsファイルを使用している場合

**回答**: **問題なく動作します**

開発PCの `/etc/hosts` で以下のように設定している場合：
```
192.168.1.100  home.docomo2.com
```

ブラウザが `https://home.docomo2.com:18443` にアクセスすると：
1. hostsファイルによりローカルIP（192.168.1.100）に接続
2. サーバーがLet's Encrypt証明書を返す
3. 証明書のドメイン名（home.docomo2.com）が一致するため検証成功

---

## Let's Encryptによる証明書取得

### 方法1: DNS-01チャレンジ（推奨）

この方法はポート80/443を開ける必要がないため、現在のポート構成（18080/18443）のままで証明書が取得できます。

#### 手順

**1. 証明書格納用ディレクトリの作成**

```bash
cd ~/docker/facility-booking-system
mkdir -p ./certbot/conf
mkdir -p ./certbot/www
```

**2. Certbotコンテナを使用して証明書を取得**

```bash
docker run --rm -it \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d home.docomo2.com
```

**注意**: `your-email@example.com` を実際のメールアドレスに変更してください。

**3. DNSレコードの追加**

Certbotが以下のような指示を表示します：

```
Please deploy a DNS TXT record under the name
_acme-challenge.home.docomo2.com with the following value:

xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Before continuing, verify the record is deployed.
Press Enter to Continue
```

**4. DDNSプロバイダーでTXTレコードを追加**

DDNSサービスの管理画面で以下のレコードを追加します：

- **タイプ**: TXT
- **名前**: `_acme-challenge.home.docomo2.com` または `_acme-challenge`
- **値**: Certbotが表示した文字列

**5. DNSレコードの確認**

別のターミナルで以下のコマンドを実行し、レコードが反映されているか確認します：

```bash
# Linux/Mac
dig _acme-challenge.home.docomo2.com TXT

# または
nslookup -type=TXT _acme-challenge.home.docomo2.com
```

レコードが確認できたら、Certbotのプロンプトで **Enter** を押します。

**6. 証明書の確認**

取得成功すると、以下のディレクトリに証明書が保存されます：

```bash
ls -la ./certbot/conf/live/home.docomo2.com/
```

以下のファイルが作成されているはずです：
- `fullchain.pem` - 証明書チェーン
- `privkey.pem` - 秘密鍵
- `cert.pem` - 証明書本体
- `chain.pem` - 中間証明書

---

### 方法2: HTTP-01チャレンジ（ポート80を一時的に開ける）

ポート80を一時的に開けられる場合はこちらの方が簡単です。

#### 手順

**1. docker-compose.ymlを一時的に変更**

```yaml
nginx:
  ports:
    - "80:80"      # 一時的に追加
    - "18080:80"
    - "18443:443"
```

**2. Nginxコンテナを再起動**

```bash
docker-compose up -d nginx
```

**3. 証明書を取得**

```bash
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d home.docomo2.com
```

**4. docker-compose.ymlを元に戻す**

```yaml
nginx:
  ports:
    - "18080:80"
    - "18443:443"
```

**5. Nginxコンテナを再起動**

```bash
docker-compose up -d nginx
```

---

## Nginx設定の変更

### 1. SSL証明書のマウント設定を有効化

**ファイル**: `docker-compose.yml`

77行目付近のコメントを解除します：

**変更前**:
```yaml
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./nginx/conf.d:/etc/nginx/conf.d:ro
  # Mount SSL certificates (create these directories if using HTTPS)
  # - /etc/letsencrypt:/etc/letsencrypt:ro
  - ./nginx/logs:/var/log/nginx
```

**変更後**:
```yaml
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./nginx/conf.d:/etc/nginx/conf.d:ro
  # Mount SSL certificates (create these directories if using HTTPS)
  - ./certbot/conf:/etc/letsencrypt:ro
  - ./nginx/logs:/var/log/nginx
```

### 2. Nginx設定ファイルの更新

**ファイル**: `nginx/conf.d/default.conf`

#### HTTPサーバーブロックの変更（HTTPからHTTPSへリダイレクト）

27行目のコメントを解除します：

**変更前**:
```nginx
# In production, uncomment this to redirect all HTTP to HTTPS
# return 301 https://$server_name$request_uri;

# For development/testing, proxy to app
location / {
    proxy_pass http://app_backend;
    # ... 省略 ...
}
```

**変更後**:
```nginx
# In production, uncomment this to redirect all HTTP to HTTPS
return 301 https://$host$request_uri;

# For development/testing, proxy to app
# location / {
#     proxy_pass http://app_backend;
#     # ... 省略 ...
# }
```

**注意**: `$server_name` ではなく `$host` を使用することで、ポート番号も含めてリダイレクトされます。

#### HTTPSサーバーブロックの有効化

48-87行目のコメントを解除し、ドメイン名を変更します：

**変更前**:
```nginx
# HTTPS server (uncomment and configure for production with SSL certificates)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name your-domain.com;
#     ...
# }
```

**変更後**:
```nginx
# HTTPS server (uncomment and configure for production with SSL certificates)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name home.docomo2.com;

    # Real IP configuration for Docker environment
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 10.0.0.0/8;
    set_real_ip_from 192.168.0.0/16;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    # SSL certificate paths (update these paths to match your setup)
    ssl_certificate /etc/letsencrypt/live/home.docomo2.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/home.docomo2.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 3. Nginx設定の構文チェック

変更後、Nginxの設定ファイルに問題がないか確認します：

```bash
docker-compose exec nginx nginx -t
```

以下のように表示されればOKです：
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## Docker Compose設定の変更

### 完全な変更例

**ファイル**: `docker-compose.yml`

Nginxサービスの`volumes`セクションを以下のように変更します：

```yaml
nginx:
  image: nginx:alpine
  container_name: facility-reservation-nginx
  restart: unless-stopped
  depends_on:
    app:
      condition: service_healthy
  ports:
    - "18080:80"
    - "18443:443"
  expose:
    - "80"
    - "443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - ./certbot/conf:/etc/letsencrypt:ro  # ← この行を追加
    - ./nginx/logs:/var/log/nginx
  networks:
    - facility-network
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
    interval: 30s
    timeout: 3s
    retries: 3
```

---

## サービスの再起動とアクセス確認

### 1. Docker Composeサービスの再起動

```bash
docker-compose down
docker-compose up -d
```

### 2. ログの確認

```bash
docker-compose logs -f nginx
```

エラーが出ていないか確認します。

### 3. HTTPSアクセスの確認

**外部からのアクセス**:
```bash
curl -I https://home.docomo2.com:18443/
```

**ローカルからのアクセス**:
```bash
curl -I https://localhost:18443/
```

正常であれば、以下のようなレスポンスが返ります：
```
HTTP/2 200
server: nginx
...
strict-transport-security: max-age=31536000; includeSubDomains
```

### 4. ブラウザでアクセス

- **外部**: https://home.docomo2.com:18443/
- **ローカル**: https://localhost:18443/ または https://192.168.1.xxx:18443/

HTTPでアクセスした場合（http://home.docomo2.com:18080/）は、自動的にHTTPSにリダイレクトされます。

---

## 証明書の自動更新設定

Let's Encryptの証明書は**90日間**で有効期限が切れます。自動更新を設定する必要があります。

### 方法1: Cronジョブで自動更新（DNS-01の場合）

DNS-01チャレンジの場合、更新時に手動でDNSレコードを設定する必要があるため、完全な自動化は困難です。

**対策**:
- 証明書の有効期限をモニタリング
- 有効期限が近づいたら手動で更新

#### 有効期限の確認コマンド

```bash
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot certificates
```

出力例：
```
Certificate Name: home.docomo2.com
  Expiry Date: 2025-05-15 12:00:00+00:00 (VALID: 89 days)
```

#### 更新コマンド（手動）

```bash
docker run --rm -it \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew \
  --manual \
  --preferred-challenges dns
```

更新後、Nginxを再起動します：

```bash
docker-compose restart nginx
```

### 方法2: Cronジョブで自動更新（HTTP-01の場合）

HTTP-01チャレンジを使用している場合は、完全自動化が可能です。

#### Cronジョブの作成

```bash
crontab -e
```

以下を追加（毎週日曜日の午前3時に実行）：

```cron
0 3 * * 0 cd /home/mining/docker/facility-booking-system && docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt -v $(pwd)/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot && docker-compose restart nginx >> /var/log/certbot-renew.log 2>&1
```

**注意**: パスを実際の環境に合わせて変更してください。

#### ログの確認

```bash
tail -f /var/log/certbot-renew.log
```

---

## 開発環境での設定

### 開発PCでのhostsファイル設定

開発PCで同じドメイン名を使ってローカルサーバーにアクセスする場合、hostsファイルを設定します。

#### Linux/Mac

```bash
sudo nano /etc/hosts
```

以下を追加（サーバーのローカルIPアドレスに置き換える）：
```
192.168.1.100  home.docomo2.com
```

#### Windows

管理者権限でメモ帳を開き、以下のファイルを編集：
```
C:\Windows\System32\drivers\etc\hosts
```

以下を追加：
```
192.168.1.100  home.docomo2.com
```

### アクセス方法

ブラウザで以下のURLにアクセス：
```
https://home.docomo2.com:18443/
```

hostsファイルの設定により、ローカルIP（192.168.1.100）に接続されますが、証明書のドメイン名（home.docomo2.com）が一致するため、SSL警告は表示されません。

---

## トラブルシューティング

### 証明書が見つからないエラー

**症状**:
```
nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/home.docomo2.com/fullchain.pem"
```

**原因**: 証明書ファイルが存在しないか、パスが間違っている

**解決方法**:

1. 証明書の存在確認：
```bash
ls -la ./certbot/conf/live/home.docomo2.com/
```

2. Nginxコンテナ内でパスを確認：
```bash
docker-compose exec nginx ls -la /etc/letsencrypt/live/home.docomo2.com/
```

3. ボリュームマウントの確認：
```bash
docker-compose config | grep -A5 "volumes:"
```

### HTTPからHTTPSへリダイレクトされない

**症状**: http://home.docomo2.com:18080/ にアクセスしても、HTTPSにリダイレクトされない

**原因**: Nginx設定でリダイレクトが有効になっていない

**解決方法**:

`nginx/conf.d/default.conf` の27行目付近を確認：
```nginx
return 301 https://$host$request_uri;
```

この行のコメントが外れているか確認し、Nginxを再起動：
```bash
docker-compose restart nginx
```

### ブラウザでSSL警告が表示される

**症状**: 「この接続ではプライバシーが保護されません」などの警告

**原因**:
1. 証明書のドメイン名とアクセスURLが一致していない
2. 証明書が有効期限切れ
3. 自己署名証明書を使用している

**解決方法**:

1. アクセスURLの確認：
   - ✓ 正: `https://home.docomo2.com:18443/`
   - ✗ 誤: `https://192.168.1.100:18443/`（IPアドレス直接）

2. 証明書の有効期限確認：
```bash
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot certificates
```

3. 証明書のドメイン名確認：
```bash
openssl x509 -in ./certbot/conf/live/home.docomo2.com/cert.pem -text -noout | grep "DNS:"
```

### Nginxが起動しない

**症状**:
```bash
docker-compose ps
```
で `nginx` が `Exit 1` などになっている

**原因**: Nginx設定ファイルの構文エラー

**解決方法**:

1. ログを確認：
```bash
docker-compose logs nginx
```

2. 設定ファイルの構文チェック：
```bash
docker run --rm \
  -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/nginx/conf.d:/etc/nginx/conf.d:ro \
  nginx:alpine nginx -t
```

3. エラー箇所を修正して再起動：
```bash
docker-compose up -d nginx
```

### DDNSの更新が遅く、外部からアクセスできない

**症状**: IPアドレスが変わった後、外部から一時的にアクセスできない

**原因**: DDNSクライアントの更新頻度が低い

**解決方法**:

1. DDNSクライアントの更新頻度を確認・調整
2. 手動で即座に更新：
   - DDNSプロバイダーの管理画面から手動更新
   - またはDDNSクライアントを再起動

3. DNS伝播の確認：
```bash
nslookup home.docomo2.com
```

現在のグローバルIPと一致しているか確認します。

---

## セキュリティ推奨事項

### 1. 強力なSSL設定

現在の設定は既に推奨設定になっていますが、定期的に見直しが必要です。

**参考**: [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

### 2. セキュリティヘッダーの追加

`nginx/conf.d/default.conf` に以下のヘッダーが設定されています：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

これらは以下の攻撃を防ぎます：
- **HSTS**: 中間者攻撃（MITM）
- **X-Frame-Options**: クリックジャッキング
- **X-Content-Type-Options**: MIMEタイプスニッフィング
- **X-XSS-Protection**: クロスサイトスクリプティング

### 3. ファイアウォール設定

不要なポートを閉じます：

```bash
# UFWの場合
sudo ufw allow 18080/tcp
sudo ufw allow 18443/tcp
sudo ufw enable
```

### 4. 定期的なセキュリティ監査

**SSL証明書の確認**:
```bash
# SSL Labsでテスト
https://www.ssllabs.com/ssltest/analyze.html?d=home.docomo2.com&s=YOUR_IP
```

**ポートスキャン**:
```bash
nmap -sV home.docomo2.com
```

### 5. ログのモニタリング

定期的にNginxログを確認：

```bash
# アクセスログ
tail -f ./nginx/logs/access.log

# エラーログ
tail -f ./nginx/logs/error.log
```

不審なアクセスがないか監視します。

### 6. バックアップ

証明書とNginx設定のバックアップ：

```bash
# バックアップディレクトリ作成
mkdir -p ~/backups/ssl-$(date +%Y%m%d)

# 証明書のバックアップ
cp -r ./certbot/conf ~/backups/ssl-$(date +%Y%m%d)/

# Nginx設定のバックアップ
cp -r ./nginx ~/backups/ssl-$(date +%Y%m%d)/
```

---

## まとめ

### SSL化後のアクセス方法

| アクセス元 | URL | 備考 |
|----------|-----|------|
| 外部（インターネット） | https://home.docomo2.com:18443/ | グローバルIP経由 |
| 内部（開発PC - hosts設定あり） | https://home.docomo2.com:18443/ | ローカルIP経由 |
| 内部（開発PC - hosts設定なし） | https://192.168.1.100:18443/ | SSL警告が出る |

### HTTPアクセスの挙動

| URL | 動作 |
|-----|------|
| http://home.docomo2.com:18080/ | → https://home.docomo2.com:18080/ へリダイレクト |
| https://home.docomo2.com:18443/ | 直接アクセス |

### 定期メンテナンス

| 項目 | 頻度 | コマンド |
|------|------|---------|
| 証明書有効期限確認 | 月1回 | `docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot certificates` |
| 証明書更新（DNS-01） | 有効期限30日前 | 手動更新（本手順書参照） |
| セキュリティアップデート | 週1回 | `docker-compose pull && docker-compose up -d` |
| ログ確認 | 週1回 | `tail -100 ./nginx/logs/access.log` |

---

## 参考リンク

- [Let's Encrypt公式ドキュメント](https://letsencrypt.org/docs/)
- [Certbot公式ドキュメント](https://eff-certbot.readthedocs.io/)
- [Nginx SSL設定ガイド](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)

---

**作成日**: 2025-11-29
**バージョン**: 1.0
**対象環境**: Docker Compose + Nginx + Let's Encrypt (DNS-01)

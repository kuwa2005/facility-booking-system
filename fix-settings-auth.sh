#!/bin/bash

# settings.ejsの認証方法をCookieベースに変更するスクリプト

FILE="/home/user/facility-booking-system/src/views/staff/settings.ejs"

# 1. トークン取得とチェックを削除
sed -i '/^const token = document.cookie/d' "$FILE"
sed -i '/デバッグ: トークンの確認/,/}/d' "$FILE"

# 2. Authorization headerを使用しているfetchをcredentials: 'include'に変更
# Authorization headerの行を削除し、credentials: 'include'を追加

sed -i "s/headers: { 'Authorization': \`Bearer \${token}\` }/credentials: 'include'/g" "$FILE"
sed -i "s/headers: {$/credentials: 'include',\n      headers: {/g" "$FILE"
sed -i "/^\s*'Authorization': \`Bearer \${token}\`,\?$/d" "$FILE"

# 3. tokenをチェックしている部分を削除
sed -i '/if (!token) {/,/return;/d' "$FILE"
sed -i "/console.log.*Using token/d" "$FILE"

echo "✓ settings.ejsを修正しました"
echo "バックアップ: src/views/staff/settings.ejs.backup"

#!/bin/bash

# すべての職員画面の認証をCookieベースに変更するスクリプト

echo "=== 職員画面の認証方式を一括修正 ==="
echo ""

FILES=(
  "activity-log.ejs"
  "announcements.ejs"
  "closed-dates.ejs"
  "dashboard.ejs"
  "equipment.ejs"
  "messages.ejs"
  "products.ejs"
  "profile.ejs"
  "proxy-reservations.ejs"
  "reports.ejs"
  "reservations.ejs"
  "rooms.ejs"
  "staff-management.ejs"
  "usages.ejs"
  "users.ejs"
)

VIEWS_DIR="/home/user/facility-booking-system/src/views/staff"

for file in "${FILES[@]}"; do
  filepath="$VIEWS_DIR/$file"

  if [ ! -f "$filepath" ]; then
    echo "⚠️  $file が見つかりません"
    continue
  fi

  echo "処理中: $file"

  # バックアップを作成
  cp "$filepath" "$filepath.backup"

  # Perlを使用して複数行パターンを処理
  perl -i -0pe '
    # トークン取得コードを削除
    s/const token = document\.cookie\.split.*?\.split.*?\[1\];//gs;

    # Authorization headerを削除して credentials: "include" に置き換え
    s/headers:\s*\{\s*\n?\s*'"'"'Authorization'"'"':\s*`Bearer\s*\$\{token\}`,?\s*\n?\s*/credentials: '"'"'include'"'"',\n      headers: {\n        /gs;

    # Authorization headerのみの行を削除
    s/'"'"'Authorization'"'"':\s*`Bearer\s*\$\{token\}`,?\s*\n?//gs;

    # credentials が既にある場合の重複を避ける
    s/(credentials:\s*'"'"'include'"'"',?\s*\n?\s*){2,}/credentials: '"'"'include'"'"',\n      /gs;

    # 空のheadersを削除
    s/headers:\s*\{\s*\},?\s*\n?//gs;

  ' "$filepath"

  echo "  ✓ 完了"
done

echo ""
echo "=== 修正完了 ==="
echo "バックアップ: 各ファイル.backup"
echo ""
echo "次のステップ:"
echo "1. git add -A"
echo "2. git commit -m 'fix: すべての職員画面の認証をCookieベースに変更'"
echo "3. git push"
echo "4. ブラウザのCookieをクリアして再ログイン"

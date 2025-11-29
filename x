#!/bin/bash
docker-compose down

# git fetch origin
# git checkout claude/fix-unread-count-api-01AWMMa3n4c3131E6ZZHmVyy
# git pull origin claude/fix-unread-count-api-01AWMMa3n4c3131E6ZZHmVyy
# キャッシュなしでビルド
#docker build --no-cache -t facility-booking-system .

git fetch origin
#git pull origin claude/fix-unread-count-api-01AWMMa3n4c3131E6ZZHmVyy
git pull origin claude/timezone-profile-improvements-01DNriChjfdQ6tGCJexswCZE
docker-compose build --no-cache app
docker-compose up -d

# ./start-ports.sh


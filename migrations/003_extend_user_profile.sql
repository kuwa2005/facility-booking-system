-- Migration: 003 - ユーザープロフィール機能の拡張
-- Description: ニックネーム、プロフィール画像、退会フラグなどを追加

-- usersテーブルにプロフィール関連のカラムを追加（既に存在する場合はスキップ）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='nickname' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN nickname VARCHAR(100) DEFAULT NULL COMMENT ''ニックネーム（表示名）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='profile_image_path' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(500) DEFAULT NULL COMMENT ''プロフィール画像のパス''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='bio' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL COMMENT ''自己紹介''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='deleted_at' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL COMMENT ''退会日時（論理削除）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='last_login_at' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL COMMENT ''最終ログイン日時''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ニックネームのインデックス追加（検索用・既に存在する場合はスキップ）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_name='users' AND index_name='idx_nickname' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD INDEX idx_nickname (nickname)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- プロフィール変更履歴テーブル（オプション、監査用）
CREATE TABLE IF NOT EXISTS user_profile_changes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    field_name VARCHAR(50) NOT NULL COMMENT '変更されたフィールド名',
    old_value TEXT DEFAULT NULL COMMENT '変更前の値',
    new_value TEXT DEFAULT NULL COMMENT '変更後の値',
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- applicationsテーブルに予約変更関連のカラムを追加（既に存在する場合はスキップ）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='applications' AND column_name='previous_application_id' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE applications ADD COLUMN previous_application_id INT UNSIGNED DEFAULT NULL COMMENT ''変更前の予約ID''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='applications' AND column_name='modified_at' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE applications ADD COLUMN modified_at DATETIME DEFAULT NULL COMMENT ''最終変更日時''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='applications' AND column_name='modification_count' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE applications ADD COLUMN modification_count INT UNSIGNED DEFAULT 0 COMMENT ''変更回数''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 予約変更履歴テーブル
CREATE TABLE IF NOT EXISTS application_modifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id INT UNSIGNED NOT NULL,
    modified_by INT UNSIGNED NOT NULL COMMENT '変更者のユーザーID',
    modification_type ENUM('update', 'cancel', 'restore') NOT NULL,
    old_data JSON DEFAULT NULL COMMENT '変更前のデータ',
    new_data JSON DEFAULT NULL COMMENT '変更後のデータ',
    reason TEXT DEFAULT NULL COMMENT '変更理由',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_application_id (application_id),
    INDEX idx_modified_by (modified_by),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ユーザーのお気に入り部屋テーブル（オプション機能）
CREATE TABLE IF NOT EXISTS user_favorite_rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    room_id INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_room (user_id, room_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

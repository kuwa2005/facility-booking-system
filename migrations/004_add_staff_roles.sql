-- ユーザーロールの追加と職員機能の実装
-- 実行日: 2025-11-17

-- users テーブルに role カラムを追加（既に存在する場合はスキップ）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='role' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN role ENUM(''user'', ''staff'', ''admin'') NOT NULL DEFAULT ''user'' COMMENT ''ユーザーの役割'' AFTER is_admin', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='staff_code' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN staff_code VARCHAR(50) DEFAULT NULL COMMENT ''職員コード（職員のみ）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='department' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT NULL COMMENT ''所属部署（職員のみ）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='position' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN position VARCHAR(100) DEFAULT NULL COMMENT ''役職（職員のみ）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='hire_date' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN hire_date DATE DEFAULT NULL COMMENT ''入職日（職員のみ）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='users' AND column_name='staff_status' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD COLUMN staff_status ENUM(''active'', ''on_leave'', ''retired'') DEFAULT ''active'' COMMENT ''職員ステータス''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_name='users' AND index_name='idx_role' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD INDEX idx_role (role)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE table_name='users' AND index_name='idx_staff_code' AND table_schema=DATABASE()) = 0,
  'ALTER TABLE users ADD INDEX idx_staff_code (staff_code)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 既存の is_admin が true のユーザーを admin ロールに更新
UPDATE users SET role = 'admin' WHERE is_admin = 1;

-- 職員のアクティビティログテーブル（既存の場合は削除して再作成）
DROP TABLE IF EXISTS staff_activity_logs;
CREATE TABLE staff_activity_logs (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    staff_id INT UNSIGNED NOT NULL COMMENT '職員ID',
    action_type VARCHAR(50) NOT NULL COMMENT 'アクション種別（login, logout, create, update, delete, approve, reject）',
    target_type VARCHAR(50) DEFAULT NULL COMMENT '対象種別（application, user, room, equipment, usage）',
    target_id INT UNSIGNED DEFAULT NULL COMMENT '対象ID',
    description TEXT COMMENT '詳細説明',
    ip_address VARCHAR(45) COMMENT 'IPアドレス',
    user_agent VARCHAR(500) COMMENT 'ユーザーエージェント',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_staff_id (staff_id),
    INDEX idx_action_type (action_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='職員のアクティビティログ';

-- 予約承認ワークフローテーブル（既存の場合は削除して再作成）
DROP TABLE IF EXISTS application_approvals;
CREATE TABLE application_approvals (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    application_id INT UNSIGNED NOT NULL COMMENT '申請ID',
    staff_id INT UNSIGNED NOT NULL COMMENT '承認・拒否した職員ID',
    action ENUM('approved', 'rejected') NOT NULL COMMENT 'アクション',
    comment TEXT COMMENT 'コメント',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_application_id (application_id),
    INDEX idx_staff_id (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='予約の承認・拒否履歴';

-- 職員メモテーブル（既存の場合は削除して再作成）
DROP TABLE IF EXISTS staff_notes;
CREATE TABLE staff_notes (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    staff_id INT UNSIGNED NOT NULL COMMENT 'メモを作成した職員ID',
    note_type ENUM('application', 'user', 'usage') NOT NULL COMMENT 'メモの種別',
    reference_id INT UNSIGNED NOT NULL COMMENT '参照ID（申請、ユーザー、利用記録のID）',
    note TEXT NOT NULL COMMENT 'メモ内容',
    is_important BOOLEAN DEFAULT FALSE COMMENT '重要フラグ',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_note_type_reference (note_type, reference_id),
    INDEX idx_staff_id (staff_id),
    INDEX idx_is_important (is_important)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='職員のメモ';

-- 通知テーブル（既存の場合は削除して再作成）
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL COMMENT '通知の宛先ユーザーID',
    notification_type VARCHAR(50) NOT NULL COMMENT '通知種別（new_application, payment_completed, cancellation, etc.）',
    title VARCHAR(200) NOT NULL COMMENT '通知タイトル',
    message TEXT NOT NULL COMMENT '通知メッセージ',
    reference_type VARCHAR(50) DEFAULT NULL COMMENT '参照種別',
    reference_id INT UNSIGNED DEFAULT NULL COMMENT '参照ID',
    is_read BOOLEAN DEFAULT FALSE COMMENT '既読フラグ',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME DEFAULT NULL COMMENT '既読日時',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id_is_read (user_id, is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知';

-- システム設定テーブル（既存の場合は削除して再作成）
DROP TABLE IF EXISTS system_settings;
CREATE TABLE system_settings (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT '設定キー',
    setting_value TEXT COMMENT '設定値',
    setting_type VARCHAR(50) NOT NULL COMMENT '設定のタイプ（string, number, boolean, json）',
    description TEXT COMMENT '設定の説明',
    updated_by INT UNSIGNED DEFAULT NULL COMMENT '最終更新者（職員ID）',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='システム設定';

-- デフォルトのシステム設定を挿入
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', '施設予約システム', 'string', 'サイト名'),
('reservation_advance_days', '90', 'number', '予約可能な最大日数（日）'),
('cancellation_deadline_hours', '24', 'number', 'キャンセル期限（使用開始時刻の何時間前まで無料キャンセル可能か）'),
('require_approval', 'false', 'boolean', '予約に職員の承認が必要か'),
('maintenance_mode', 'false', 'boolean', 'メンテナンスモード'),
('contact_email', 'info@example.com', 'string', '問い合わせ先メールアドレス'),
('business_hours', '{"start": "09:00", "end": "21:30"}', 'json', '営業時間');

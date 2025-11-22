-- Migration 006: お知らせ、メッセージング、ユーザーメモ機能の追加
-- Created: 2025-11-17

-- =====================================================
-- お知らせテーブル（既存の場合は削除して再作成）
-- =====================================================
DROP TABLE IF EXISTS announcements;
CREATE TABLE announcements (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT 'お知らせタイトル',
    content TEXT NOT NULL COMMENT 'お知らせ本文',
    announcement_type ENUM('public', 'user') NOT NULL DEFAULT 'public' COMMENT 'お知らせ種別: public=全員向け, user=一般利用者向け',
    priority INT NOT NULL DEFAULT 0 COMMENT '優先度（数値が大きいほど上位表示）',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    starts_at DATETIME DEFAULT NULL COMMENT '表示開始日時（NULL = 即時表示）',
    ends_at DATETIME DEFAULT NULL COMMENT '表示終了日時（NULL = 無期限）',
    created_by INT UNSIGNED NOT NULL COMMENT '作成した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_announcement_type (announcement_type),
    INDEX idx_is_active (is_active),
    INDEX idx_starts_at (starts_at),
    INDEX idx_ends_at (ends_at),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_created_by (created_by),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='お知らせテーブル';

-- =====================================================
-- メッセージテーブル（001で作成済みなのでこのマイグレーションでは作成しない）
-- =====================================================
-- messages テーブルは 001_create_tables.sql で既に作成されています
-- 既存のmessagesテーブルの構造を変更する場合はALTER TABLEを使用してください

-- =====================================================
-- ユーザーメモテーブル（管理者専用・既存の場合は削除して再作成）
-- =====================================================
DROP TABLE IF EXISTS user_notes;
CREATE TABLE user_notes (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL COMMENT '対象ユーザーID',
    note_content TEXT NOT NULL COMMENT 'メモ内容',
    note_category VARCHAR(50) DEFAULT NULL COMMENT 'カテゴリ（warning, info, reminder等）',
    created_by INT UNSIGNED NOT NULL COMMENT '作成した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_user_id (user_id),
    INDEX idx_created_by (created_by),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_note_category (note_category),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザーメモテーブル（管理者専用）';

-- =====================================================
-- サンプルデータ挿入（開発用）
-- =====================================================

-- サンプル公開お知らせ（全員向け）
INSERT IGNORE INTO announcements (title, content, announcement_type, priority, created_by) VALUES
('施設利用時間の変更について', '2025年12月より、施設の利用時間が変更となります。詳細は受付までお問い合わせください。', 'public', 10, 1),
('年末年始の休館日のお知らせ', '12月29日～1月3日は休館日となります。ご了承ください。', 'public', 9, 1);

-- サンプル一般利用者向けお知らせ
INSERT IGNORE INTO announcements (title, content, announcement_type, priority, created_by) VALUES
('会員限定イベントのご案内', '会員様限定のイベントを開催いたします。詳細は追ってご連絡いたします。', 'user', 8, 1),
('料金改定のお知らせ', '2025年4月より、一部料金を改定させていただきます。', 'user', 7, 1);

-- =====================================================
-- 期限切れ未読メッセージ削除用ストアドプロシージャ
-- ※ Node.jsのMySQLクライアントはDELIMITERをサポートしていないため、
--    ストアドプロシージャは別途MySQLクライアントから作成するか、
--    アプリケーション側でスケジューラを実装してください
-- =====================================================

-- 以下のコマンドをMySQLコマンドラインクライアントで実行する場合:
-- DROP PROCEDURE IF EXISTS cleanup_expired_unread_messages;
-- DELIMITER //
-- CREATE PROCEDURE cleanup_expired_unread_messages()
-- BEGIN
--     UPDATE messages
--     SET deleted_at = NOW()
--     WHERE expires_at IS NOT NULL
--       AND expires_at < NOW()
--       AND read_at IS NULL
--       AND deleted_at IS NULL;
-- END //
-- DELIMITER ;
--
-- DROP EVENT IF EXISTS evt_cleanup_expired_messages;
-- CREATE EVENT evt_cleanup_expired_messages
-- ON SCHEDULE EVERY 1 HOUR
-- DO CALL cleanup_expired_unread_messages();

-- 代わりに、アプリケーション側で定期的に以下のクエリを実行することを推奨:
-- UPDATE messages SET deleted_at = NOW()
-- WHERE expires_at IS NOT NULL AND expires_at < NOW()
--   AND read_at IS NULL AND deleted_at IS NULL;

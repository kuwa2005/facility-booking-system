-- Migration 006: お知らせ、メッセージング、ユーザーメモ機能の追加
-- Created: 2025-11-17

-- =====================================================
-- お知らせテーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT 'お知らせタイトル',
    content TEXT NOT NULL COMMENT 'お知らせ本文',
    announcement_type ENUM('public', 'user') NOT NULL DEFAULT 'public' COMMENT 'お知らせ種別: public=全員向け, user=一般利用者向け',
    priority INT NOT NULL DEFAULT 0 COMMENT '優先度（数値が大きいほど上位表示）',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    starts_at DATETIME DEFAULT NULL COMMENT '表示開始日時（NULL = 即時表示）',
    ends_at DATETIME DEFAULT NULL COMMENT '表示終了日時（NULL = 無期限）',
    created_by INT NOT NULL COMMENT '作成した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_announcement_type (announcement_type),
    INDEX idx_is_active (is_active),
    INDEX idx_starts_at (starts_at),
    INDEX idx_ends_at (ends_at),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_created_by (created_by),

    FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='お知らせテーブル';

-- =====================================================
-- メッセージテーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_type ENUM('user', 'staff') NOT NULL COMMENT '送信者タイプ',
    sender_id INT NOT NULL COMMENT '送信者ID',
    recipient_type ENUM('user', 'staff') NOT NULL COMMENT '受信者タイプ',
    recipient_id INT NOT NULL COMMENT '受信者ID',
    subject VARCHAR(200) NOT NULL COMMENT '件名',
    content TEXT NOT NULL COMMENT '本文',
    parent_message_id INT DEFAULT NULL COMMENT '返信先メッセージID（NULL = 新規スレッド）',
    expires_at DATETIME DEFAULT NULL COMMENT '有効期限（管理者からのメッセージのみ）',
    read_at DATETIME DEFAULT NULL COMMENT '既読日時',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_sender (sender_type, sender_id),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_parent_message (parent_message_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_read_at (read_at),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_created_at (created_at),

    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL,

    -- 制約: 一般利用者同士のメッセージは不可（実装レベルで制御）
    CONSTRAINT chk_no_user_to_user CHECK (
        NOT (sender_type = 'user' AND recipient_type = 'user')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='メッセージテーブル';

-- =====================================================
-- ユーザーメモテーブル（管理者専用）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '対象ユーザーID',
    note_content TEXT NOT NULL COMMENT 'メモ内容',
    note_category VARCHAR(50) DEFAULT NULL COMMENT 'カテゴリ（warning, info, reminder等）',
    created_by INT NOT NULL COMMENT '作成した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_user_id (user_id),
    INDEX idx_created_by (created_by),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_note_category (note_category),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザーメモテーブル（管理者専用）';

-- =====================================================
-- サンプルデータ挿入（開発用）
-- =====================================================

-- サンプル公開お知らせ（全員向け）
INSERT INTO announcements (title, content, announcement_type, priority, created_by) VALUES
('施設利用時間の変更について', '2025年12月より、施設の利用時間が変更となります。詳細は受付までお問い合わせください。', 'public', 10, 1),
('年末年始の休館日のお知らせ', '12月29日～1月3日は休館日となります。ご了承ください。', 'public', 9, 1);

-- サンプル一般利用者向けお知らせ
INSERT INTO announcements (title, content, announcement_type, priority, created_by) VALUES
('会員限定イベントのご案内', '会員様限定のイベントを開催いたします。詳細は追ってご連絡いたします。', 'user', 8, 1),
('料金改定のお知らせ', '2025年4月より、一部料金を改定させていただきます。', 'user', 7, 1);

-- =====================================================
-- 期限切れ未読メッセージ削除用ストアドプロシージャ
-- =====================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS cleanup_expired_unread_messages()
BEGIN
    -- 有効期限切れ かつ 未読のメッセージを論理削除
    UPDATE messages
    SET deleted_at = NOW()
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
      AND read_at IS NULL
      AND deleted_at IS NULL;
END //

DELIMITER ;

-- =====================================================
-- 定期実行用イベント（期限切れメッセージの自動削除）
-- ※ MySQLのイベントスケジューラーを有効にする必要があります
-- SET GLOBAL event_scheduler = ON;
-- =====================================================
CREATE EVENT IF NOT EXISTS evt_cleanup_expired_messages
ON SCHEDULE EVERY 1 HOUR
DO CALL cleanup_expired_unread_messages();

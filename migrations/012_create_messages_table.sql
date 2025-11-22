-- Migration 012: メッセージテーブルの作成
-- Created: 2025-11-22
-- Description: 一般利用者と職員間のメッセージング機能用テーブル

DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    sender_type ENUM('user', 'staff') NOT NULL COMMENT '送信者タイプ',
    sender_id INT UNSIGNED NOT NULL COMMENT '送信者ID',
    recipient_type ENUM('user', 'staff') NOT NULL COMMENT '受信者タイプ',
    recipient_id INT UNSIGNED NOT NULL COMMENT '受信者ID',
    subject VARCHAR(200) NOT NULL COMMENT '件名',
    content TEXT NOT NULL COMMENT '本文',
    parent_message_id INT UNSIGNED DEFAULT NULL COMMENT '親メッセージID（返信の場合）',
    expires_at DATETIME DEFAULT NULL COMMENT '有効期限（職員から一般利用者へのメッセージのみ）',
    read_at DATETIME DEFAULT NULL COMMENT '既読日時',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_sender (sender_type, sender_id),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_parent_message_id (parent_message_id),
    INDEX idx_read_at (read_at),
    INDEX idx_expires_at (expires_at),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_created_at (created_at),

    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='メッセージテーブル（一般利用者⇔職員）';

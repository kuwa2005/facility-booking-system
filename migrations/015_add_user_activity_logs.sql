-- ユーザーアクティビティログテーブルの作成
-- 一般ユーザー（非職員）のアクティビティを記録するためのテーブル

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL COMMENT 'ユーザーID',
    action_type VARCHAR(50) NOT NULL COMMENT 'アクション種別（login, logout, create, update, delete）',
    target_type VARCHAR(50) DEFAULT NULL COMMENT '対象種別（application, review, message, favorite）',
    target_id INT UNSIGNED DEFAULT NULL COMMENT '対象ID',
    description TEXT COMMENT '詳細説明',
    ip_address VARCHAR(45) COMMENT 'IPアドレス',
    user_agent VARCHAR(500) COMMENT 'ユーザーエージェント',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='一般ユーザーのアクティビティログ';

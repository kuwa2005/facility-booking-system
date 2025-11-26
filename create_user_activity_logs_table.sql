-- ユーザーアクティビティログテーブルの作成
-- このファイルをデータベースに直接実行してください
-- 例: mysql -u root -p facility_reservation < create_user_activity_logs_table.sql

USE facility_reservation;

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL COMMENT 'ユーザーID',
    action_type VARCHAR(50) NOT NULL COMMENT 'アクション種別（login, logout, view_room, attempt_booking, create_booking, attempt_cancel, cancel_booking, attempt_payment, complete_payment, send_message, add_favorite, remove_favorite, post_review, search, check_availability）',
    target_type VARCHAR(50) DEFAULT NULL COMMENT '対象種別（application, room, review, message, favorite）',
    target_id INT UNSIGNED DEFAULT NULL COMMENT '対象ID',
    description TEXT COMMENT '詳細説明',
    metadata JSON DEFAULT NULL COMMENT '追加のメタデータ（JSON形式）',
    ip_address VARCHAR(45) COMMENT 'IPアドレス',
    user_agent VARCHAR(500) COMMENT 'ユーザーエージェント',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='一般ユーザーのアクティビティログ';

SELECT 'user_activity_logs テーブルが作成されました' AS Status;

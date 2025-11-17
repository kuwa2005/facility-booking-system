-- Migration 007: 自動通知システムの追加
-- Created: 2025-11-17

-- =====================================================
-- 通知テンプレートテーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'テンプレート識別コード',
    template_name VARCHAR(200) NOT NULL COMMENT 'テンプレート名',
    description TEXT COMMENT 'テンプレートの説明',
    subject VARCHAR(500) NOT NULL COMMENT 'メール件名（変数使用可能）',
    body_text TEXT NOT NULL COMMENT 'メール本文（テキスト版）',
    body_html TEXT COMMENT 'メール本文（HTML版）',
    available_variables JSON COMMENT '利用可能な変数のリスト',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    is_system BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'システムテンプレート（削除不可）',
    created_by INT DEFAULT NULL COMMENT '作成した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '論理削除日時',

    INDEX idx_template_code (template_code),
    INDEX idx_is_active (is_active),
    INDEX idx_deleted_at (deleted_at),

    FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知テンプレートテーブル';

-- =====================================================
-- 通知ログテーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(50) NOT NULL COMMENT '使用したテンプレートコード',
    notification_type ENUM('email', 'sms', 'push') NOT NULL DEFAULT 'email' COMMENT '通知タイプ',
    recipient_type ENUM('user', 'staff') NOT NULL COMMENT '受信者タイプ',
    recipient_id INT NOT NULL COMMENT '受信者ID',
    recipient_email VARCHAR(255) NOT NULL COMMENT '送信先メールアドレス',
    subject VARCHAR(500) NOT NULL COMMENT '実際に送信した件名',
    body_text TEXT COMMENT '実際に送信した本文',
    status ENUM('pending', 'sent', 'failed', 'bounced') NOT NULL DEFAULT 'pending' COMMENT '送信ステータス',
    error_message TEXT COMMENT 'エラーメッセージ（失敗時）',
    related_entity_type VARCHAR(50) COMMENT '関連エンティティタイプ（application等）',
    related_entity_id INT COMMENT '関連エンティティID',
    sent_at DATETIME COMMENT '送信日時',
    opened_at DATETIME COMMENT '開封日時（トラッキング有効時）',
    clicked_at DATETIME COMMENT 'リンククリック日時（トラッキング有効時）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_template_code (template_code),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at),
    INDEX idx_related_entity (related_entity_type, related_entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知ログテーブル';

-- =====================================================
-- 通知設定テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT '設定キー',
    setting_name VARCHAR(200) NOT NULL COMMENT '設定名',
    description TEXT COMMENT '設定の説明',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    template_code VARCHAR(50) COMMENT '使用するテンプレートコード',
    send_timing VARCHAR(50) COMMENT '送信タイミング（immediate, scheduled等）',
    schedule_config JSON COMMENT 'スケジュール設定（リマインダー用）',
    updated_by INT COMMENT '最終更新者',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_setting_key (setting_key),
    INDEX idx_is_enabled (is_enabled),

    FOREIGN KEY (updated_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知設定テーブル';

-- =====================================================
-- スケジュール通知テーブル
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(50) NOT NULL COMMENT 'テンプレートコード',
    recipient_type ENUM('user', 'staff') NOT NULL COMMENT '受信者タイプ',
    recipient_id INT NOT NULL COMMENT '受信者ID',
    related_entity_type VARCHAR(50) COMMENT '関連エンティティタイプ',
    related_entity_id INT COMMENT '関連エンティティID',
    scheduled_at DATETIME NOT NULL COMMENT '送信予定日時',
    status ENUM('pending', 'sent', 'cancelled', 'failed') NOT NULL DEFAULT 'pending' COMMENT 'ステータス',
    notification_data JSON COMMENT '通知に必要なデータ',
    sent_at DATETIME COMMENT '実際の送信日時',
    error_message TEXT COMMENT 'エラーメッセージ',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_status (status),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_related_entity (related_entity_type, related_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='スケジュール通知テーブル';

-- =====================================================
-- システムテンプレートの挿入
-- =====================================================

-- 予約完了通知テンプレート
INSERT INTO notification_templates (template_code, template_name, description, subject, body_text, available_variables, is_system) VALUES
('application_created', '予約完了通知', 'ユーザーが予約を作成した時に送信',
'【予約完了】{{facility_name}} のご予約を承りました',
'{{user_name}} 様

{{facility_name}} のご予約を承りました。

■予約内容
予約番号: {{application_id}}
施設名: {{facility_name}}
部屋: {{room_name}}
利用日: {{usage_date}}
時間帯: {{time_slots}}
人数: {{attendees}}名
合計金額: {{total_amount}}円

予約は現在承認待ちの状態です。
承認完了後、改めてご連絡いたします。

ご不明な点がございましたら、お気軽にお問い合わせください。',
'["user_name", "facility_name", "room_name", "application_id", "usage_date", "time_slots", "attendees", "total_amount"]',
TRUE);

-- 予約承認通知テンプレート
INSERT INTO notification_templates (template_code, template_name, description, subject, body_text, available_variables, is_system) VALUES
('application_approved', '予約承認通知', '予約が承認された時に送信',
'【予約承認】{{facility_name}} のご予約が承認されました',
'{{user_name}} 様

{{facility_name}} のご予約が承認されました。

■予約内容
予約番号: {{application_id}}
施設名: {{facility_name}}
部屋: {{room_name}}
利用日: {{usage_date}}
時間帯: {{time_slots}}
人数: {{attendees}}名
合計金額: {{total_amount}}円

当日は開始時刻の15分前までに受付にお越しください。

それでは、当日お待ちしております。',
'["user_name", "facility_name", "room_name", "application_id", "usage_date", "time_slots", "attendees", "total_amount"]',
TRUE);

-- 予約却下通知テンプレート
INSERT INTO notification_templates (template_code, template_name, description, subject, body_text, available_variables, is_system) VALUES
('application_rejected', '予約却下通知', '予約が却下された時に送信',
'【予約不可】{{facility_name}} のご予約について',
'{{user_name}} 様

誠に申し訳ございませんが、{{facility_name}} のご予約を承ることができませんでした。

■予約内容
予約番号: {{application_id}}
施設名: {{facility_name}}
部屋: {{room_name}}
利用日: {{usage_date}}
時間帯: {{time_slots}}

{{#if reason}}
理由: {{reason}}
{{/if}}

ご不明な点がございましたら、お問い合わせください。',
'["user_name", "facility_name", "room_name", "application_id", "usage_date", "time_slots", "reason"]',
TRUE);

-- 利用日前日リマインダー
INSERT INTO notification_templates (template_code, template_name, description, subject, body_text, available_variables, is_system) VALUES
('usage_reminder', '利用日前日リマインダー', '利用日の前日に送信',
'【リマインダー】明日は{{facility_name}}のご利用日です',
'{{user_name}} 様

明日は{{facility_name}}のご利用日です。

■予約内容
予約番号: {{application_id}}
施設名: {{facility_name}}
部屋: {{room_name}}
利用日: {{usage_date}}
時間帯: {{time_slots}}
人数: {{attendees}}名

開始時刻の15分前までに受付にお越しください。

お忘れ物のないよう、お気をつけてお越しください。',
'["user_name", "facility_name", "room_name", "application_id", "usage_date", "time_slots", "attendees"]',
TRUE);

-- 支払期限リマインダー
INSERT INTO notification_templates (template_code, template_name, description, subject, body_text, available_variables, is_system) VALUES
('payment_reminder', '支払期限リマインダー', '支払期限が近づいた時に送信',
'【お支払いのお願い】{{facility_name}} ご利用料金について',
'{{user_name}} 様

{{facility_name}}のご利用料金のお支払い期限が近づいております。

■お支払い情報
予約番号: {{application_id}}
利用日: {{usage_date}}
合計金額: {{total_amount}}円
支払期限: {{payment_deadline}}

お支払い方法については、受付にてご確認ください。

期限までにお支払いがない場合、予約が取り消される場合がございますので、ご注意ください。',
'["user_name", "facility_name", "application_id", "usage_date", "total_amount", "payment_deadline"]',
TRUE);

-- =====================================================
-- デフォルト通知設定の挿入
-- =====================================================
INSERT INTO notification_settings (setting_key, setting_name, description, is_enabled, template_code, send_timing) VALUES
('notify_application_created', '予約完了通知', '予約作成時にユーザーに通知', TRUE, 'application_created', 'immediate'),
('notify_application_approved', '予約承認通知', '予約承認時にユーザーに通知', TRUE, 'application_approved', 'immediate'),
('notify_application_rejected', '予約却下通知', '予約却下時にユーザーに通知', TRUE, 'application_rejected', 'immediate'),
('notify_usage_reminder', '利用日前日リマインダー', '利用日の前日19時に通知', TRUE, 'usage_reminder', 'scheduled'),
('notify_payment_reminder', '支払期限リマインダー', '支払期限3日前に通知', TRUE, 'payment_reminder', 'scheduled');

-- =====================================================
-- リマインダー送信用ストアドプロシージャ
-- =====================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS schedule_usage_reminders()
BEGIN
    -- 明日利用予定の承認済み予約に対してリマインダーをスケジュール
    INSERT INTO scheduled_notifications (
        template_code,
        recipient_type,
        recipient_id,
        related_entity_type,
        related_entity_id,
        scheduled_at,
        notification_data
    )
    SELECT
        'usage_reminder',
        'user',
        a.user_id,
        'application',
        a.id,
        DATE_SUB(DATE(u.date), INTERVAL 1 DAY) + INTERVAL 19 HOUR,
        JSON_OBJECT(
            'application_id', a.id,
            'usage_date', u.date,
            'room_id', u.room_id
        )
    FROM applications a
    INNER JOIN usages u ON a.id = u.application_id
    WHERE a.user_id IS NOT NULL
      AND DATE(u.date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      AND NOT EXISTS (
          SELECT 1 FROM scheduled_notifications sn
          WHERE sn.related_entity_type = 'application'
            AND sn.related_entity_id = a.id
            AND sn.template_code = 'usage_reminder'
      );
END //

DELIMITER ;

-- =====================================================
-- 定期実行用イベント（リマインダースケジューリング）
-- =====================================================
CREATE EVENT IF NOT EXISTS evt_schedule_reminders
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 6 HOUR)
DO CALL schedule_usage_reminders();

-- =====================================================
-- スケジュール通知送信用ストアドプロシージャ
-- =====================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS process_scheduled_notifications()
BEGIN
    -- 送信時刻が来たスケジュール通知を取得して処理
    -- 実際の送信処理はアプリケーション層で実行
    UPDATE scheduled_notifications
    SET status = 'pending'
    WHERE scheduled_at <= NOW()
      AND status = 'pending';
END //

DELIMITER ;

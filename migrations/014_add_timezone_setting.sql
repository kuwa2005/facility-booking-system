-- Migration 014: タイムゾーン設定の追加
-- Created: 2025-11-25

-- システム設定にタイムゾーン設定を追加
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('timezone', 'Asia/Tokyo', 'string', 'システムのタイムゾーン（例: Asia/Tokyo, America/New_York, Europe/London）'),
('timezone_offset', '+09:00', 'string', 'タイムゾーンのオフセット（例: +09:00, -05:00）');

-- お知らせ一覧に表示する件数の設定を追加
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('mypage_announcements_count', '5', 'number', 'マイページに表示するお知らせの最大件数');

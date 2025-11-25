-- Add admin_staff_id setting for message recipient configuration

INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'admin_staff_id',
  '2',
  'number',
  '一般ユーザーからのメッセージを受信する管理者スタッフのID'
)
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  setting_type = VALUES(setting_type),
  description = VALUES(description);

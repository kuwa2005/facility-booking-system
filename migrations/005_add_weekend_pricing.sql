-- 施設に土日祝日料金を追加

ALTER TABLE rooms
  ADD COLUMN weekend_price_morning INT UNSIGNED DEFAULT NULL COMMENT '土日祝日の午前料金 (09:00-12:00)',
  ADD COLUMN weekend_price_afternoon INT UNSIGNED DEFAULT NULL COMMENT '土日祝日の午後料金 (13:00-17:00)',
  ADD COLUMN weekend_price_evening INT UNSIGNED DEFAULT NULL COMMENT '土日祝日の夜間料金 (18:00-21:30)',
  ADD COLUMN weekend_extension_price_midday INT UNSIGNED DEFAULT NULL COMMENT '土日祝日の正午延長料金 (12:00-13:00)',
  ADD COLUMN weekend_extension_price_evening INT UNSIGNED DEFAULT NULL COMMENT '土日祝日の夕方延長料金 (17:00-18:00)';

-- 祝日管理テーブルを作成
CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL COMMENT '祝日の日付',
  name VARCHAR(255) NOT NULL COMMENT '祝日名（例：元日、成人の日）',
  is_recurring BOOLEAN DEFAULT FALSE COMMENT '毎年繰り返すか',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date (date),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='祝日管理（休館日とは別）';

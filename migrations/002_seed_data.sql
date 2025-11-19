-- Migration: 002 - Seed initial data
-- Description: Inserts sample rooms and equipment catalog

-- Seed Rooms
INSERT IGNORE INTO rooms (name, capacity, base_price_morning, base_price_afternoon, base_price_evening, extension_price_midday, extension_price_evening, ac_price_per_hour, description, is_active) VALUES
('多目的ホール (Multipurpose Hall)', 200, 15000, 20000, 18000, 3000, 3000, 1000, '大型イベント対応の多目的ホール', TRUE),
('小会議室1 (Small Meeting Room 1)', 20, 3000, 4000, 3500, 500, 500, 300, '少人数向け会議室', TRUE),
('小会議室2 (Small Meeting Room 2)', 20, 3000, 4000, 3500, 500, 500, 300, '少人数向け会議室', TRUE),
('練習室1 (Studio 1)', 15, 2000, 2500, 2500, 400, 400, 250, '音楽・ダンス練習用', TRUE),
('練習室2 (Studio 2)', 15, 2000, 2500, 2500, 400, 400, 250, '音楽・ダンス練習用', TRUE);

-- Seed Equipment - Stage category
INSERT IGNORE INTO equipment (category, name, price_type, unit_price, max_quantity, enabled, remark) VALUES
('stage', '演台 (Podium)', 'per_slot', 500, 1, TRUE, 'Standard podium for speakers'),
('stage', '司会台 (MC Table)', 'per_slot', 200, 1, TRUE, 'Master of ceremony table'),
('stage', '花台 (Flower Stand)', 'per_slot', 100, 1, TRUE, 'Decorative flower stand');

-- Seed Equipment - Lighting category (as one set)
INSERT IGNORE INTO equipment (category, name, price_type, unit_price, max_quantity, enabled, remark) VALUES
('lighting', '照明一式 (Lighting Set)', 'flat', 3000, 1, TRUE, 'Complete lighting set including border light, suspension light, upper/lower horizon light');

-- Seed Equipment - Sound category
INSERT IGNORE INTO equipment (category, name, price_type, unit_price, max_quantity, enabled, remark) VALUES
('sound', 'ワイヤレスマイクセット (Wireless Microphone Set)', 'per_slot', 500, 4, TRUE, 'Wireless microphone set'),
('sound', 'ダイナミックマイク (Dynamic Microphone)', 'flat', 2000, 1, TRUE, 'Standard dynamic microphone set'),
('sound', 'ワイヤレスマイク (Wireless Mic)', 'flat', 2000, 1, TRUE, 'Individual wireless microphone'),
('sound', 'ピンマイク (Tie-pin Microphone)', 'flat', 2000, 1, TRUE, 'Tie-pin microphone set'),
('sound', 'グランドピアノ (Grand Piano)', 'per_slot', 3000, 1, TRUE, 'Full-size grand piano'),
('sound', 'ポータブルアンプセット (Portable Amplifier Set)', 'per_slot', 500, 1, TRUE, 'Portable amplifier system');

-- Seed Equipment - Other category
INSERT IGNORE INTO equipment (category, name, price_type, unit_price, max_quantity, enabled, remark) VALUES
('other', 'トランシーバー (Walkie Talkie)', 'per_slot', 500, 5, TRUE, 'Two-way radio communication device'),
('other', 'プロジェクター・ホール用 (Projector - Hall)', 'per_slot', 1000, 1, TRUE, 'High-brightness projector for main hall'),
('other', 'プロジェクター・会議室用 (Projector - Meeting Room)', 'per_slot', 500, 1, TRUE, 'Standard projector for meeting rooms'),
('other', 'モニターTV (Monitor TV)', 'per_slot', 500, 1, TRUE, 'Display monitor for presentations');

-- Create default admin user
-- Password: admin123 (hashed with bcrypt, cost factor 10)
-- Note: This should be changed immediately in production
INSERT IGNORE INTO users (email, password_hash, name, organization_name, phone, address, is_active, is_admin, email_verified) VALUES
('admin@example.com', '$2b$10$rKzE8qF5YhX5vQmJ5YxJXe9O5Y3pQZ5YmJ5YxJXe9O5Y3pQZ5YmJ5Y', 'System Administrator', 'Facility Management', '000-0000-0000', 'Admin Office', TRUE, TRUE, TRUE);

-- Seed some sample closed dates (Japanese holidays for 2025)
INSERT IGNORE INTO closed_dates (date, reason) VALUES
('2025-01-01', '元日 (New Year\'s Day)'),
('2025-01-13', '成人の日 (Coming of Age Day)'),
('2025-02-11', '建国記念の日 (National Foundation Day)'),
('2025-02-23', '天皇誕生日 (Emperor\'s Birthday)'),
('2025-03-20', '春分の日 (Vernal Equinox Day)'),
('2025-04-29', '昭和の日 (Showa Day)'),
('2025-05-03', '憲法記念日 (Constitution Memorial Day)'),
('2025-05-04', 'みどりの日 (Greenery Day)'),
('2025-05-05', 'こどもの日 (Children\'s Day)'),
('2025-07-21', '海の日 (Marine Day)'),
('2025-08-11', '山の日 (Mountain Day)'),
('2025-09-15', '敬老の日 (Respect for the Aged Day)'),
('2025-09-23', '秋分の日 (Autumnal Equinox Day)'),
('2025-10-13', 'スポーツの日 (Sports Day)'),
('2025-11-03', '文化の日 (Culture Day)'),
('2025-11-23', '勤労感謝の日 (Labor Thanksgiving Day)');

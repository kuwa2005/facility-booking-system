-- Migration: 010 - Create staff accounts
-- Description: Create default admin and staff accounts for testing

-- パスワード: admin123 のbcryptハッシュ (cost factor 10)
-- 管理者アカウント
INSERT INTO users (
    email,
    password_hash,
    name,
    organization_name,
    phone,
    address,
    is_active,
    is_admin,
    email_verified,
    role,
    staff_code,
    department,
    position,
    hire_date,
    staff_status
) VALUES (
    'admin@facility.local',
    '$2b$10$rKzE8qF5YhX5vQmJ5YxJXuKHZWJ5YxJXuKHZWJ5YxJXuKHZWJ5YxJX',
    '管理者',
    '施設管理センター',
    '03-1234-5678',
    '東京都',
    TRUE,
    TRUE,
    TRUE,
    'admin',
    'ADMIN001',
    '総務部',
    '管理者',
    '2024-01-01',
    'active'
) ON DUPLICATE KEY UPDATE
    role = 'admin',
    staff_code = 'ADMIN001';

-- パスワード: staff123 のbcryptハッシュ (cost factor 10)
-- 職員アカウント1
INSERT INTO users (
    email,
    password_hash,
    name,
    organization_name,
    phone,
    address,
    is_active,
    is_admin,
    email_verified,
    role,
    staff_code,
    department,
    position,
    hire_date,
    staff_status
) VALUES (
    'staff@facility.local',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    '職員 太郎',
    '施設管理センター',
    '03-1234-5679',
    '東京都',
    TRUE,
    FALSE,
    TRUE,
    'staff',
    'STAFF001',
    '運営部',
    '職員',
    '2024-04-01',
    'active'
) ON DUPLICATE KEY UPDATE
    role = 'staff',
    staff_code = 'STAFF001';

-- 職員アカウント2
INSERT INTO users (
    email,
    password_hash,
    name,
    organization_name,
    phone,
    address,
    is_active,
    is_admin,
    email_verified,
    role,
    staff_code,
    department,
    position,
    hire_date,
    staff_status
) VALUES (
    'staff2@facility.local',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    '職員 花子',
    '施設管理センター',
    '03-1234-5680',
    '東京都',
    TRUE,
    FALSE,
    TRUE,
    'staff',
    'STAFF002',
    '運営部',
    '主任',
    '2024-02-01',
    'active'
) ON DUPLICATE KEY UPDATE
    role = 'staff',
    staff_code = 'STAFF002';

-- 貸し館システムの機能拡充
-- 時間帯管理、物販、部屋別休館日などの機能を追加
-- 実行日: 2025-11-17

-- 時間帯マスターテーブル
CREATE TABLE IF NOT EXISTS time_slots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '時間帯名（例：午前、午後、夜間、シャワー30分）',
    code VARCHAR(50) NOT NULL UNIQUE COMMENT '時間帯コード（システム内部用）',
    start_time TIME NOT NULL COMMENT '開始時刻',
    end_time TIME NOT NULL COMMENT '終了時刻',
    duration_minutes INT NOT NULL COMMENT '利用時間（分）',
    slot_type ENUM('regular', 'extension', 'flexible') NOT NULL DEFAULT 'regular' COMMENT '時間帯種別（regular: 通常, extension: 延長, flexible: 自由時間）',
    display_order INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    description TEXT COMMENT '説明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_slot_type (slot_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='時間帯マスター';

-- デフォルトの時間帯を挿入
INSERT INTO time_slots (name, code, start_time, end_time, duration_minutes, slot_type, display_order) VALUES
('午前', 'morning', '09:00:00', '12:00:00', 180, 'regular', 1),
('正午延長', 'midday_extension', '12:00:00', '13:00:00', 60, 'extension', 2),
('午後', 'afternoon', '13:00:00', '17:00:00', 240, 'regular', 3),
('夜間延長', 'evening_extension', '17:00:00', '18:00:00', 60, 'extension', 4),
('夜間', 'evening', '18:00:00', '21:30:00', 210, 'regular', 5);

-- 部屋ごとの時間帯別料金テーブル
CREATE TABLE IF NOT EXISTS room_time_slot_prices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL COMMENT '部屋ID',
    time_slot_id INT NOT NULL COMMENT '時間帯ID',
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '基本料金',
    ac_price_per_hour DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '1時間あたりの空調料金',
    is_available BOOLEAN NOT NULL DEFAULT TRUE COMMENT '利用可能フラグ',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_timeslot (room_id, time_slot_id),
    INDEX idx_room_id (room_id),
    INDEX idx_time_slot_id (time_slot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部屋ごとの時間帯別料金';

-- 部屋と設備の関連テーブル（多対多）
CREATE TABLE IF NOT EXISTS room_equipment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL COMMENT '部屋ID',
    equipment_id INT NOT NULL COMMENT '設備ID',
    is_available BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'この部屋でこの設備が利用可能か',
    notes TEXT COMMENT '備考',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_equipment (room_id, equipment_id),
    INDEX idx_room_id (room_id),
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部屋と設備の関連';

-- 物販商品テーブル
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL COMMENT '商品名',
    category VARCHAR(100) NOT NULL COMMENT 'カテゴリ（parking_ticket, towel, etc.）',
    price DECIMAL(10, 2) NOT NULL COMMENT '販売価格',
    cost DECIMAL(10, 2) DEFAULT NULL COMMENT '原価',
    stock_quantity INT DEFAULT NULL COMMENT '在庫数（NULLの場合は在庫管理しない）',
    is_available BOOLEAN NOT NULL DEFAULT TRUE COMMENT '販売可能フラグ',
    description TEXT COMMENT '商品説明',
    display_order INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_is_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物販商品マスター';

-- デフォルト商品を挿入
INSERT INTO products (name, category, price, stock_quantity, description, display_order) VALUES
('駐車券', 'parking_ticket', 100.00, NULL, '1枚100円の駐車券', 1);

-- 販売記録テーブル
CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id INT DEFAULT NULL COMMENT '予約ID（予約に紐づく場合）',
    product_id INT NOT NULL COMMENT '商品ID',
    quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
    unit_price DECIMAL(10, 2) NOT NULL COMMENT '単価（販売時の価格）',
    total_price DECIMAL(10, 2) NOT NULL COMMENT '合計金額',
    sold_by INT NOT NULL COMMENT '販売した職員ID',
    sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '販売日時',
    customer_name VARCHAR(200) DEFAULT NULL COMMENT '購入者名',
    notes TEXT COMMENT '備考',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_application_id (application_id),
    INDEX idx_product_id (product_id),
    INDEX idx_sold_by (sold_by),
    INDEX idx_sold_at (sold_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='販売記録';

-- 部屋別休館日テーブル
CREATE TABLE IF NOT EXISTS room_closed_dates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL COMMENT '部屋ID',
    date DATE NOT NULL COMMENT '休館日',
    reason VARCHAR(500) NOT NULL COMMENT '理由',
    closed_time_slots JSON DEFAULT NULL COMMENT '休止する時間帯ID配列（NULLの場合は終日休館）',
    created_by INT NOT NULL COMMENT '登録した職員ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_room_date (room_id, date),
    INDEX idx_room_id (room_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部屋別休館日';

-- 予約代行記録テーブル
CREATE TABLE IF NOT EXISTS application_proxies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id INT NOT NULL COMMENT '申請ID',
    created_by_staff INT NOT NULL COMMENT '予約を代行した職員ID',
    user_id INT DEFAULT NULL COMMENT '対象ユーザーID（会員の場合）',
    proxy_type ENUM('for_member', 'for_guest') NOT NULL COMMENT '代行種別（会員/ゲスト）',
    notes TEXT COMMENT '代行時のメモ',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_staff) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_application (application_id),
    INDEX idx_created_by_staff (created_by_staff),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='予約代行記録';

-- 既存のusagesテーブルに時間帯IDカラムを追加（将来的な移行のため）
ALTER TABLE usages
ADD COLUMN time_slot_ids JSON DEFAULT NULL COMMENT '使用した時間帯ID配列' AFTER use_evening_extension;

-- applicationsテーブルに物販合計額カラムを追加
ALTER TABLE applications
ADD COLUMN product_sales_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '物販販売額' AFTER total_amount;

-- rooms テーブルにイレギュラー対応フラグを追加
ALTER TABLE rooms
ADD COLUMN is_flexible_time BOOLEAN NOT NULL DEFAULT FALSE COMMENT '自由時間制かどうか（シャワー室など）' AFTER is_active,
ADD COLUMN min_duration_minutes INT DEFAULT NULL COMMENT '最小利用時間（分）',
ADD COLUMN time_unit_minutes INT DEFAULT NULL COMMENT '時間単位（分）',
ADD COLUMN price_per_unit DECIMAL(10, 2) DEFAULT NULL COMMENT '単位あたりの料金';

-- 休館日種別を追加
ALTER TABLE closed_dates
ADD COLUMN closure_type ENUM('full', 'partial', 'year_end') NOT NULL DEFAULT 'full' COMMENT '休館種別（full: 全館, partial: 一部, year_end: 年末年始）' AFTER reason,
ADD COLUMN affected_rooms JSON DEFAULT NULL COMMENT '影響を受ける部屋ID配列（partial の場合）';

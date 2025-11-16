-- Migration: 001 - Create initial database schema for facility reservation system
-- Description: Creates all core tables for users, rooms, equipment, applications, and usages

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL COMMENT 'Representative/applicant name',
    organization_name VARCHAR(255) DEFAULT NULL COMMENT 'Group/organization name',
    phone VARCHAR(50) NOT NULL,
    address TEXT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE COMMENT 'Admin flag for staff users',
    email_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10) DEFAULT NULL,
    verification_code_expires_at DATETIME DEFAULT NULL,
    password_reset_token VARCHAR(255) DEFAULT NULL,
    password_reset_expires_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_verification_code (verification_code),
    INDEX idx_password_reset_token (password_reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Room name (e.g., Multipurpose Hall)',
    capacity INT UNSIGNED DEFAULT NULL COMMENT 'Maximum capacity',
    base_price_morning INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Base price for morning slot (09:00-12:00)',
    base_price_afternoon INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Base price for afternoon slot (13:00-17:00)',
    base_price_evening INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Base price for evening slot (18:00-21:30)',
    extension_price_midday INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Price for midday extension (12:00-13:00)',
    extension_price_evening INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Price for evening extension (17:00-18:00)',
    ac_price_per_hour INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Air conditioning price per hour',
    description TEXT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category ENUM('stage', 'lighting', 'sound', 'other') NOT NULL,
    name VARCHAR(255) NOT NULL,
    price_type ENUM('per_slot', 'flat', 'free') NOT NULL DEFAULT 'per_slot',
    unit_price INT UNSIGNED NOT NULL DEFAULT 0,
    max_quantity INT UNSIGNED NOT NULL DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    remark TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Applications table (one per event/reservation)
CREATE TABLE IF NOT EXISTS applications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL COMMENT 'NULL for guest applications',

    -- Applicant information
    applicant_address TEXT DEFAULT NULL,
    applicant_group_name VARCHAR(255) DEFAULT NULL,
    applicant_representative VARCHAR(255) NOT NULL,
    applicant_phone VARCHAR(50) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,

    -- Event information
    event_name VARCHAR(255) NOT NULL,
    expected_attendees INT UNSIGNED DEFAULT NULL,
    event_description TEXT DEFAULT NULL,
    program_attachment_path VARCHAR(500) DEFAULT NULL COMMENT 'Path to uploaded program file',

    -- Entrance fee and multiplier
    entrance_fee_type ENUM('free', 'paid') NOT NULL DEFAULT 'free',
    entrance_fee_amount INT UNSIGNED DEFAULT 0,
    ticket_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 1.00 COMMENT 'Price multiplier based on entrance fee',

    -- Optional facility details
    use_digital_signboard BOOLEAN DEFAULT FALSE,
    setup_datetime DATETIME DEFAULT NULL,
    meeting_date DATE DEFAULT NULL COMMENT 'Pre-meeting date if applicable',
    hall_manager_name VARCHAR(255) DEFAULT NULL,
    hall_manager_phone VARCHAR(50) DEFAULT NULL,
    signboard_entrance BOOLEAN DEFAULT FALSE,
    signboard_stage BOOLEAN DEFAULT FALSE,
    open_time TIME DEFAULT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL,
    remarks TEXT DEFAULT NULL,

    -- Financial and status
    total_amount INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total amount for all usages',
    payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
    payment_provider_id VARCHAR(255) DEFAULT NULL COMMENT 'External payment provider transaction ID',
    cancel_status ENUM('none', 'cancelled') NOT NULL DEFAULT 'none',
    cancelled_at DATETIME DEFAULT NULL,
    cancellation_fee INT UNSIGNED DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_cancel_status (cancel_status),
    INDEX idx_applicant_email (applicant_email),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usages table (one per room per date)
CREATE TABLE IF NOT EXISTS usages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id INT UNSIGNED NOT NULL,
    room_id INT UNSIGNED NOT NULL,
    date DATE NOT NULL COMMENT 'Date of use',

    -- Time slots
    use_morning BOOLEAN DEFAULT FALSE COMMENT '09:00-12:00',
    use_afternoon BOOLEAN DEFAULT FALSE COMMENT '13:00-17:00',
    use_evening BOOLEAN DEFAULT FALSE COMMENT '18:00-21:30',
    use_midday_extension BOOLEAN DEFAULT FALSE COMMENT '12:00-13:00',
    use_evening_extension BOOLEAN DEFAULT FALSE COMMENT '17:00-18:00',

    -- Air conditioning
    ac_requested BOOLEAN DEFAULT FALSE,
    ac_hours DECIMAL(4, 1) DEFAULT NULL COMMENT 'Actual AC hours used (staff-entered)',

    -- Pricing breakdown
    room_base_charge_before_multiplier INT UNSIGNED NOT NULL DEFAULT 0,
    room_charge_after_multiplier INT UNSIGNED NOT NULL DEFAULT 0,
    equipment_charge INT UNSIGNED NOT NULL DEFAULT 0,
    ac_charge INT UNSIGNED NOT NULL DEFAULT 0,
    subtotal_amount INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total for this usage line',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    INDEX idx_application_id (application_id),
    INDEX idx_room_date (room_id, date),
    INDEX idx_date (date),
    UNIQUE KEY unique_room_date_application (application_id, room_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Equipment Usage (junction table for equipment used in each usage)
CREATE TABLE IF NOT EXISTS usage_equipment (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usage_id INT UNSIGNED NOT NULL,
    equipment_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    slot_count INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Number of main slots (for per_slot pricing)',
    line_amount INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total charge for this equipment line',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (usage_id) REFERENCES usages(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT,
    INDEX idx_usage_id (usage_id),
    INDEX idx_equipment_id (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Closed dates table (for holidays and maintenance days)
CREATE TABLE IF NOT EXISTS closed_dates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    reason VARCHAR(255) DEFAULT NULL COMMENT 'Reason for closure (holiday, maintenance, etc.)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log table (optional but recommended for tracking changes)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    entity_type VARCHAR(50) NOT NULL COMMENT 'Table name (applications, usages, etc.)',
    entity_id INT UNSIGNED NOT NULL,
    action ENUM('create', 'update', 'delete', 'cancel') NOT NULL,
    old_values JSON DEFAULT NULL,
    new_values JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

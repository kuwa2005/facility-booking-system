-- 009_add_contact_messages.sql
-- お問い合わせメッセージテーブルの作成

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'お問い合わせ者氏名',
  email VARCHAR(255) NOT NULL COMMENT 'お問い合わせ者メールアドレス',
  phone VARCHAR(20) COMMENT 'お問い合わせ者電話番号',
  category VARCHAR(50) NOT NULL COMMENT 'お問い合わせ種別 (reservation, facility, payment, cancel, system, other)',
  message TEXT NOT NULL COMMENT 'お問い合わせ内容',
  status ENUM('pending', 'in_progress', 'resolved', 'closed') DEFAULT 'pending' COMMENT 'ステータス',
  staff_note TEXT COMMENT '職員メモ',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='お問い合わせメッセージ（非会員含む）';

-- messagesテーブルにsystemタイプのsender_typeを追加できるようにする
-- （既存のテーブルなので、ALTER TABLEは必要に応じて実施）

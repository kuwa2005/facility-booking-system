-- Migration 013: 施設在庫管理機能の追加
-- Created: 2025-11-23
-- Description: 各施設の最大予約可能数（在庫数）を管理するフィールドを追加

-- rooms テーブルに最大予約可能数を追加
ALTER TABLE rooms
ADD COLUMN max_reservation_count INT UNSIGNED NOT NULL DEFAULT 1
COMMENT '最大予約可能数（在庫数）。同じ日時・時間帯に予約可能な数。現在は1で運用、将来的に同じタイプの部屋を1つの施設名で管理する場合に増やす可能性がある。'
AFTER is_active;

-- 既存のすべての部屋の max_reservation_count を 1 に設定（デフォルトで設定されているが明示的に実行）
UPDATE rooms SET max_reservation_count = 1 WHERE max_reservation_count IS NULL OR max_reservation_count = 0;

-- インデックス追加（予約可能チェックの高速化）
ALTER TABLE usages ADD INDEX idx_room_date_timeslots (room_id, date, use_morning, use_afternoon, use_evening);

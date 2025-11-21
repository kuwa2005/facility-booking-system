-- Migration: Add display_order column to rooms table
-- Purpose: Allow staff to customize the order in which rooms are displayed to users

-- Add display_order column to rooms table
ALTER TABLE rooms
ADD COLUMN display_order INT UNSIGNED DEFAULT 0 COMMENT 'Display order for room listing (lower numbers appear first)' AFTER is_active,
ADD INDEX idx_display_order (display_order);

-- Initialize display_order with current IDs (existing rooms will maintain their current order)
UPDATE rooms SET display_order = id WHERE display_order = 0;

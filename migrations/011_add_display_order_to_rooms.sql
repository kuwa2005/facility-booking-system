-- Migration: Add display_order column to rooms table
-- Purpose: Allow staff to customize the order in which rooms are displayed to users

-- Check if display_order column exists, if not add it
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'display_order'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE rooms ADD COLUMN display_order INT UNSIGNED DEFAULT 0 COMMENT ''Display order for room listing (lower numbers appear first)'' AFTER is_active',
  'SELECT ''Column display_order already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if index exists, if not add it
SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND INDEX_NAME = 'idx_display_order'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE rooms ADD INDEX idx_display_order (display_order)',
  'SELECT ''Index idx_display_order already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Initialize display_order with current IDs (only for rooms where display_order is 0)
UPDATE rooms SET display_order = id WHERE display_order = 0;

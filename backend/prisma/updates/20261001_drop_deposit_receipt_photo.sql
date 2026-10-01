SET @ddl = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'collector_deposits'
      AND column_name = 'receipt_photo'
  ),
  'ALTER TABLE collector_deposits DROP COLUMN receipt_photo',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

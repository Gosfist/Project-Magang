SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'invoices'
    AND column_name = 'reminder_sent_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoices ADD COLUMN reminder_sent_at DATETIME(3) NULL AFTER paid_at',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

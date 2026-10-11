SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'additional_roles');
SET @sql = IF(@has_column = 0, 'ALTER TABLE users ADD COLUMN additional_roles JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

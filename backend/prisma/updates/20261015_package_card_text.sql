-- Optional marketing text; existing package names, prices and network settings stay intact.
SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'harga_paket' AND column_name = 'title');
SET @sql = IF(@has_column = 0, 'ALTER TABLE harga_paket ADD COLUMN title VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'harga_paket' AND column_name = 'description');
SET @sql = IF(@has_column = 0, 'ALTER TABLE harga_paket ADD COLUMN description VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

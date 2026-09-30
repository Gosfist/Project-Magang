-- Support either Prisma-generated or legacy SQL foreign key names.
SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'pppoe_account_id' AND REFERENCED_TABLE_NAME = 'daftar_pelanggan' LIMIT 1);
SET @ddl = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE invoices DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
ALTER TABLE invoices MODIFY pppoe_account_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_invoices_account_preserved FOREIGN KEY (pppoe_account_id) REFERENCES daftar_pelanggan(id) ON DELETE SET NULL;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_snapshot'), 'SELECT 1', 'ALTER TABLE invoices ADD COLUMN customer_snapshot JSON NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collector_deposits' AND COLUMN_NAME = 'pppoe_account_id' AND REFERENCED_TABLE_NAME = 'daftar_pelanggan' LIMIT 1);
SET @ddl = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE collector_deposits DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
ALTER TABLE collector_deposits MODIFY pppoe_account_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_deposits_account_preserved FOREIGN KEY (pppoe_account_id) REFERENCES daftar_pelanggan(id) ON DELETE SET NULL;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'collector_deposits' AND column_name = 'customer_snapshot'), 'SELECT 1', 'ALTER TABLE collector_deposits ADD COLUMN customer_snapshot JSON NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'activity_logs' AND column_name = 'entity_type'), 'SELECT 1', 'ALTER TABLE activity_logs ADD COLUMN entity_type VARCHAR(30) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'activity_logs' AND column_name = 'entity_id'), 'SELECT 1', 'ALTER TABLE activity_logs ADD COLUMN entity_id VARCHAR(30) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'activity_logs' AND index_name = 'activity_logs_entity_idx'), 'SELECT 1', 'ALTER TABLE activity_logs ADD INDEX activity_logs_entity_idx (entity_type, entity_id)');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

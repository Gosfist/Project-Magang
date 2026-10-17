-- Retain old VPN records and NAS links as legacy. Only explicitly added WireGuard IP records use the new flow.
SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vpn_clients' AND column_name = 'vpn_type');
SET @sql = IF(@has_column = 0, 'ALTER TABLE vpn_clients ADD COLUMN vpn_type VARCHAR(20) NOT NULL DEFAULT ''legacy''', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

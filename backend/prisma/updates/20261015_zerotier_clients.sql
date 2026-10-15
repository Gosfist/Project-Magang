-- Preserve legacy VPN records; no existing keys, routers, or networks are deleted.
ALTER TABLE vpn_clients MODIFY vpn_server_id BIGINT UNSIGNED NULL, MODIFY client_public_key TEXT NULL;

SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vpn_clients' AND column_name = 'zerotier_network_id');
SET @sql = IF(@has_column = 0, 'ALTER TABLE vpn_clients ADD COLUMN zerotier_network_id VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vpn_clients' AND column_name = 'zerotier_node_id');
SET @sql = IF(@has_column = 0, 'ALTER TABLE vpn_clients ADD COLUMN zerotier_node_id VARCHAR(10) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vpn_clients' AND column_name = 'device_type');
SET @sql = IF(@has_column = 0, 'ALTER TABLE vpn_clients ADD COLUMN device_type VARCHAR(20) NOT NULL DEFAULT ''mikrotik''', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

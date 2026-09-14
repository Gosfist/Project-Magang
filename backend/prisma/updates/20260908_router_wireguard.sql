-- =====================================================
-- Migration: Router & WireGuard Tunnel Management
-- Date: 2026-09-08
-- =====================================================

-- 1. Create vpn_servers table (WireGuard only)
CREATE TABLE IF NOT EXISTS vpn_servers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  host VARCHAR(100) NOT NULL,
  subnet VARCHAR(50) NOT NULL DEFAULT '10.200.0.0/24',
  wg_port INT UNSIGNED NOT NULL DEFAULT 51820,
  wg_public_key TEXT NOT NULL,
  wg_private_key TEXT NULL,
  pool_start INT UNSIGNED NOT NULL DEFAULT 10,
  pool_end INT UNSIGNED NOT NULL DEFAULT 254,
  gateway VARCHAR(45) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create vpn_clients table (WireGuard only)
CREATE TABLE IF NOT EXISTS vpn_clients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  vpn_server_id BIGINT UNSIGNED NOT NULL,
  vpn_ip VARCHAR(45) NOT NULL,
  client_public_key TEXT NOT NULL,
  client_private_key TEXT NULL,
  allowed_ips VARCHAR(100) NOT NULL DEFAULT '10.200.0.0/24',
  description TEXT NULL,
  is_radius_server TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vpn_clients_server FOREIGN KEY (vpn_server_id) REFERENCES vpn_servers(id) ON DELETE CASCADE,
  INDEX idx_vpn_clients_server (vpn_server_id),
  INDEX idx_vpn_clients_ip (vpn_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Upgrade nas table with Router fields
ALTER TABLE nas
  ADD COLUMN name VARCHAR(100) NULL,
  ADD COLUMN auth_mode VARCHAR(20) NOT NULL DEFAULT 'radius',
  ADD COLUMN ip_address VARCHAR(45) NULL,
  ADD COLUMN username VARCHAR(64) NULL,
  ADD COLUMN password TEXT NULL,
  ADD COLUMN port INT UNSIGNED NULL DEFAULT 8728,
  ADD COLUMN vpn_client_id BIGINT UNSIGNED NULL,
  ADD COLUMN latitude DOUBLE NULL,
  ADD COLUMN longitude DOUBLE NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT fk_nas_vpn_client FOREIGN KEY (vpn_client_id) REFERENCES vpn_clients(id) ON DELETE SET NULL;

CREATE INDEX idx_nas_vpn_client ON nas(vpn_client_id);

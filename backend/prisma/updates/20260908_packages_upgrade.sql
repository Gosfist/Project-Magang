ALTER TABLE pppoe_packages
  ADD COLUMN cost_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN ip_pool_id BIGINT UNSIGNED DEFAULT NULL,
  ADD COLUMN validity_days INT UNSIGNED NOT NULL DEFAULT 30,
  ADD CONSTRAINT fk_packages_ip_pool FOREIGN KEY (ip_pool_id) REFERENCES ip_pools(id) ON DELETE SET NULL;
CREATE INDEX idx_packages_ip_pool ON pppoe_packages(ip_pool_id);

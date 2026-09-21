-- Alur pasang baru Sales -> Teknisi dan bukti pembayaran kolektor.
UPDATE users SET role = 'teknisi' WHERE role = 'petugas';

CREATE TABLE IF NOT EXISTS psb_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_number BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  pppoe_package_id BIGINT UNSIGNED NOT NULL,
  area_id BIGINT UNSIGNED NULL,
  sales_user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESS',
  username VARCHAR(64) NULL,
  password TEXT NULL,
  odp VARCHAR(100) NULL,
  router_nas_id INT UNSIGNED NULL,
  installation_photo LONGTEXT NULL,
  pppoe_account_id BIGINT UNSIGNED NULL,
  activated_by_user_id BIGINT UNSIGNED NULL,
  completed_by_user_id BIGINT UNSIGNED NULL,
  activated_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY psb_orders_customer_number_key (customer_number),
  UNIQUE KEY psb_orders_pppoe_account_id_key (pppoe_account_id),
  KEY psb_orders_status_created_at_idx (status, created_at),
  KEY psb_orders_sales_user_id_idx (sales_user_id),
  KEY psb_orders_pppoe_package_id_idx (pppoe_package_id),
  CONSTRAINT psb_orders_package_fk FOREIGN KEY (pppoe_package_id) REFERENCES pppoe_packages(id),
  CONSTRAINT psb_orders_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
  CONSTRAINT psb_orders_sales_fk FOREIGN KEY (sales_user_id) REFERENCES users(id),
  CONSTRAINT psb_orders_activated_by_fk FOREIGN KEY (activated_by_user_id) REFERENCES users(id),
  CONSTRAINT psb_orders_completed_by_fk FOREIGN KEY (completed_by_user_id) REFERENCES users(id),
  CONSTRAINT psb_orders_account_fk FOREIGN KEY (pppoe_account_id) REFERENCES pppoe_accounts(id) ON DELETE SET NULL,
  CONSTRAINT psb_orders_router_fk FOREIGN KEY (router_nas_id) REFERENCES nas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE collector_deposits ADD COLUMN receipt_photo LONGTEXT NULL AFTER notes;

INSERT INTO app_settings (`key`, `value`) VALUES
  ('psb_payment_mode', 'full'),
  ('psb_fee', '0')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

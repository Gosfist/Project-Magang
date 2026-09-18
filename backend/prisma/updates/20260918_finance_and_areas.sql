-- Migration untuk modul Finance dan Area Management (18 September 2026)

-- 1. Tabel areas (Wilayah Pelanggan)
CREATE TABLE IF NOT EXISTS `areas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `areas_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Tambah kolom area_id ke pppoe_accounts
ALTER TABLE `pppoe_accounts` ADD COLUMN `area_id` BIGINT UNSIGNED NULL AFTER `pppoe_package_id`;

-- 3. Tabel area_collectors (Penugasan Kolektor ke Area)
CREATE TABLE IF NOT EXISTS `area_collectors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `area_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `area_collectors_area_id_user_id_key` (`area_id`, `user_id`),
  INDEX `area_collectors_user_id_idx` (`user_id`),
  CONSTRAINT `fk_area_collectors_area` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_area_collectors_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Tabel collector_deposits (Setoran Kolektor)
CREATE TABLE IF NOT EXISTS `collector_deposits` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `collector_user_id` BIGINT UNSIGNED NOT NULL,
  `amount` BIGINT UNSIGNED NOT NULL,
  `deposit_date` DATE NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `accepted_by_user_id` BIGINT UNSIGNED NULL,
  `accepted_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `collector_deposits_pppoe_account_id_idx` (`pppoe_account_id`),
  INDEX `collector_deposits_collector_user_id_idx` (`collector_user_id`),
  INDEX `collector_deposits_status_idx` (`status`),
  CONSTRAINT `fk_collector_deposits_account` FOREIGN KEY (`pppoe_account_id`) REFERENCES `pppoe_accounts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collector_deposits_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collector_deposits_collector` FOREIGN KEY (`collector_user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_collector_deposits_accepted_by` FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Tabel finance_transactions (Transaksi Keuangan)
CREATE TABLE IF NOT EXISTS `finance_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(15) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `amount` BIGINT UNSIGNED NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `reference_type` VARCHAR(30) NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `created_by_user_id` BIGINT UNSIGNED NOT NULL,
  `transaction_date` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `finance_transactions_type_idx` (`type`),
  INDEX `finance_transactions_transaction_date_idx` (`transaction_date`),
  INDEX `finance_transactions_created_by_user_id_idx` (`created_by_user_id`),
  CONSTRAINT `fk_finance_transactions_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

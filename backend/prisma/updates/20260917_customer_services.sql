-- Additive migration. Run once against the same database used by backend/.env.
CREATE TABLE IF NOT EXISTS `customer_addons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `amount` BIGINT UNSIGNED NOT NULL,
  `notes` TEXT NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `customer_addons_pppoe_account_id_idx` (`pppoe_account_id`),
  CONSTRAINT `customer_addons_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `pppoe_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_promises` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
  `promised_date` DATE NOT NULL,
  `deadline` DATETIME(3) NOT NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',
  `invoice_ids` JSON NOT NULL,
  `original_expires_at` DATE NULL,
  `disconnect_pending` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `payment_promises_pppoe_account_id_status_idx` (`pppoe_account_id`, `status`),
  INDEX `payment_promises_status_deadline_idx` (`status`, `deadline`),
  CONSTRAINT `payment_promises_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `pppoe_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

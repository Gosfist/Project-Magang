-- Tabel log pesan notifikasi Bot WhatsApp
CREATE TABLE IF NOT EXISTS `bot_wa_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `recipient` VARCHAR(50) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'success',
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bot_wa_logs_created_at` (`created_at`),
  INDEX `idx_bot_wa_logs_recipient` (`recipient`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

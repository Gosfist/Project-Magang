-- Pengaturan aplikasi untuk aturan penagihan, zona waktu, dan auto isolir.
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `app_settings` (`key`, `value`) VALUES
  ('billing_start_day', '1'),
  ('billing_end_day', '10'),
  ('billing_timezone', 'WIB'),
  ('auto_isolation_enabled', 'false'),
  ('isolation_check_hour', '0')
ON DUPLICATE KEY UPDATE `value` = `value`;

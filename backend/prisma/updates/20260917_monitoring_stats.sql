-- Migration for Monitoring Stats & Historical Charts
CREATE TABLE IF NOT EXISTS `server_stats` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recorded_at` DATETIME(3) NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `mem_used` BIGINT UNSIGNED NOT NULL,
  `mem_total` BIGINT UNSIGNED NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `server_stats_recorded_at_idx` (`recorded_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `router_stats` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nas_id` INT UNSIGNED NOT NULL,
  `recorded_at` DATETIME(3) NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `mem_free` BIGINT UNSIGNED NOT NULL,
  `mem_total` BIGINT UNSIGNED NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  `uptime` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `router_stats_nas_id_recorded_at_idx` (`nas_id`, `recorded_at`),
  INDEX `router_stats_recorded_at_idx` (`recorded_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `server_stats_monthly` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `year` SMALLINT UNSIGNED NOT NULL,
  `month` TINYINT UNSIGNED NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  `samples` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `server_stats_monthly_year_month_key` (`year`, `month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `router_stats_monthly` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nas_id` INT UNSIGNED NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `month` TINYINT UNSIGNED NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  `samples` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `router_stats_monthly_nas_id_year_month_key` (`nas_id`, `year`, `month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `server_stats_yearly` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `year` SMALLINT UNSIGNED NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  `samples` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `server_stats_yearly_year_key` (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `router_stats_yearly` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nas_id` INT UNSIGNED NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `cpu_percent` DOUBLE NOT NULL,
  `mem_percent` DOUBLE NOT NULL,
  `net_down` DOUBLE NOT NULL,
  `net_up` DOUBLE NOT NULL,
  `samples` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `router_stats_yearly_nas_id_year_key` (`nas_id`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

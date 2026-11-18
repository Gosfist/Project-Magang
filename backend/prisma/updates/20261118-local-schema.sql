-- UPDATE SEKALI untuk database LOKAL lama unzanet, diperiksa pada 18 November 2026.
-- Target: backend/prisma/schema.prisma saat file ini dibuat; MySQL 8.4.
-- Jangan jalankan pada database terbaru atau VPS yang belum dibandingkan skemanya.
-- Hentikan backend selama update. DDL MySQL auto-commit; backup penuh diperlukan.
-- Tidak mengubah JWT_SECRET, password pengguna, atau kredensial PPPoE/VPN.
USE `unzanet`;
SET NAMES utf8mb4;

-- Arsip struktur/data yang sudah tidak dipakai aplikasi, sebelum kolom dihapus.
CREATE DATABASE `unzanet_arsip_20261118` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `unzanet_arsip_20261118`.`area_collectors_legacy` AS SELECT `id`, `is_default` FROM `area_collectors`;
CREATE TABLE `unzanet_arsip_20261118`.`collector_deposits_legacy` AS SELECT `id`, `receipt_photo` FROM `collector_deposits`;
CREATE TABLE `unzanet_arsip_20261118`.`nas_legacy` AS SELECT `id`, `auth_mode`, `password`, `port`, `username` FROM `nas`;

-- Ganti nama tabel/kolom sambil mempertahankan isinya dan relasi yang ada.
RENAME TABLE `pppoe_accounts` TO `daftar_pelanggan`, `pppoe_packages` TO `harga_paket`, `app_settings` TO `website_settings`;
ALTER TABLE `areas` RENAME COLUMN `name` TO `nama_area`, RENAME COLUMN `description` TO `deskripsi`;

-- DropForeignKey
ALTER TABLE `collector_deposits` DROP FOREIGN KEY `collector_deposits_pppoe_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `daftar_pelanggan` DROP FOREIGN KEY `pppoe_accounts_area_id_fkey`;

-- DropForeignKey
ALTER TABLE `daftar_pelanggan` DROP FOREIGN KEY `pppoe_accounts_pppoe_package_id_fkey`;

-- DropForeignKey
ALTER TABLE `daftar_pelanggan` DROP FOREIGN KEY `pppoe_accounts_router_nas_id_fkey`;

-- DropForeignKey
ALTER TABLE `harga_paket` DROP FOREIGN KEY `pppoe_packages_ip_pool_id_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_pppoe_account_id_fkey`;

-- DropIndex
DROP INDEX `ip_pools_name_key` ON `ip_pools`;

-- DropIndex
DROP INDEX `nas_nasname_idx` ON `nas`;

-- AlterTable
ALTER TABLE `activity_logs` ADD COLUMN `entity_id` VARCHAR(30) NULL,
    ADD COLUMN `entity_type` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `area_collectors` DROP COLUMN `is_default`;

-- AlterTable
ALTER TABLE `collector_deposits` DROP COLUMN `receipt_photo`,
    ADD COLUMN `customer_snapshot` JSON NULL,
    MODIFY `pppoe_account_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `daftar_pelanggan` ADD COLUMN `manual_isolated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `odp_port` INTEGER UNSIGNED NULL,
    ADD COLUMN `terminated_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `harga_paket` ADD COLUMN `description` VARCHAR(500) NULL,
    ADD COLUMN `title` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `customer_snapshot` JSON NULL,
    ADD COLUMN `reminder_sent_at` DATETIME(3) NULL,
    MODIFY `pppoe_account_id` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `ip_pools` ADD COLUMN `router_nas_id` INTEGER UNSIGNED NULL;

-- AlterTable
ALTER TABLE `main_core` ADD COLUMN `router_nas_id` INTEGER UNSIGNED NULL;

-- AlterTable
ALTER TABLE `nas` DROP COLUMN `auth_mode`,
    DROP COLUMN `password`,
    DROP COLUMN `port`,
    DROP COLUMN `username`,
    ADD COLUMN `coa_port` SMALLINT UNSIGNED NOT NULL DEFAULT 3799,
    ADD COLUMN `radius_server_ip` VARCHAR(45) NULL,
    ADD COLUMN `vpn_host` VARCHAR(253) NULL,
    ADD COLUMN `vpn_username` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `psb_orders` ADD COLUMN `installation_fee_paid` BIGINT UNSIGNED NULL,
    ADD COLUMN `sales_commission` BIGINT UNSIGNED NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `additional_roles` JSON NULL,
    ADD COLUMN `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `vpn_clients` ADD COLUMN `password_encrypted` TEXT NULL,
    ADD COLUMN `provisioned_at` DATETIME(3) NULL,
    ADD COLUMN `username` VARCHAR(64) NULL,
    ADD COLUMN `vpn_type` VARCHAR(20) NOT NULL DEFAULT 'legacy',
    MODIFY `vpn_server_id` BIGINT UNSIGNED NULL,
    MODIFY `client_public_key` TEXT NULL;

-- Arsip tabel pemantauan router lama.
RENAME TABLE `router_stats` TO `unzanet_arsip_20261118`.`router_stats`;

-- Arsip tabel pemantauan router lama.
RENAME TABLE `router_stats_monthly` TO `unzanet_arsip_20261118`.`router_stats_monthly`;

-- Arsip tabel pemantauan router lama.
RENAME TABLE `router_stats_yearly` TO `unzanet_arsip_20261118`.`router_stats_yearly`;

-- CreateTable
CREATE TABLE `subscription_terminations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
    `requested_by_user_id` BIGINT UNSIGNED NOT NULL,
    `collected_by_user_id` BIGINT UNSIGNED NULL,
    `requested_by_name` VARCHAR(255) NOT NULL,
    `collected_by_name` VARCHAR(255) NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `collected_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `wa_sent_at` DATETIME(3) NULL,

    INDEX `subscription_terminations_pppoe_account_id_idx`(`pppoe_account_id`),
    INDEX `subscription_terminations_status_requested_at_idx`(`status`, `requested_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_payroll_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `effective_from` DATE NOT NULL,
    `absence_tracking_from` DATE NOT NULL,
    `salary_type` VARCHAR(10) NOT NULL,
    `amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `max_leave` INTEGER UNSIGNED NOT NULL DEFAULT 4,
    `excess_leave_cut` BOOLEAN NOT NULL DEFAULT false,
    `excess_leave_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `late_cut` BOOLEAN NOT NULL DEFAULT false,
    `late_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `early_cut` BOOLEAN NOT NULL DEFAULT false,
    `early_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_payroll_profiles_user_id_effective_from_key`(`user_id`, `effective_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_attendance` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `work_date` DATE NOT NULL,
    `check_in` DATETIME(3) NOT NULL,
    `check_out` DATETIME(3) NULL,
    `scheduled_start` DATETIME(3) NOT NULL,
    `scheduled_end` DATETIME(3) NOT NULL,
    `auto_checkout_at` DATETIME(3) NOT NULL,
    `is_late` BOOLEAN NOT NULL DEFAULT false,
    `checkout_source` VARCHAR(10) NULL,

    INDEX `employee_attendance_check_out_auto_checkout_at_idx`(`check_out`, `auto_checkout_at`),
    UNIQUE INDEX `employee_attendance_user_id_work_date_key`(`user_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_leaves` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `work_date` DATE NOT NULL,
    `note` VARCHAR(500) NOT NULL DEFAULT '',
    `recorded_by_user_id` BIGINT UNSIGNED NOT NULL,

    UNIQUE INDEX `employee_leaves_user_id_work_date_key`(`user_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `psb_team_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `psb_order_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `bonus_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `psb_team_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `psb_team_members_psb_order_id_user_id_key`(`psb_order_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `activity_logs_entity_type_entity_id_idx` ON `activity_logs`(`entity_type`, `entity_id`);

-- CreateIndex
CREATE UNIQUE INDEX `daftar_pelanggan_id_card_number_key` ON `daftar_pelanggan`(`id_card_number`);

-- CreateIndex
CREATE UNIQUE INDEX `daftar_pelanggan_phone_key` ON `daftar_pelanggan`(`phone`);

-- CreateIndex
CREATE UNIQUE INDEX `daftar_pelanggan_odp_port_key` ON `daftar_pelanggan`(`odp`, `odp_port`);

-- CreateIndex
CREATE UNIQUE INDEX `ip_pools_router_nas_id_name_key` ON `ip_pools`(`router_nas_id`, `name`);

-- CreateIndex
CREATE INDEX `main_core_router_nas_id_idx` ON `main_core`(`router_nas_id`);

-- CreateIndex
CREATE UNIQUE INDEX `nas_nasname_key` ON `nas`(`nasname`);

-- CreateIndex
CREATE UNIQUE INDEX `nas_vpn_client_id_key` ON `nas`(`vpn_client_id`);

-- CreateIndex
CREATE UNIQUE INDEX `psb_orders_phone_key` ON `psb_orders`(`phone`);

-- CreateIndex
CREATE UNIQUE INDEX `psb_orders_id_card_number_key` ON `psb_orders`(`id_card_number`);

-- CreateIndex
CREATE UNIQUE INDEX `vpn_clients_username_key` ON `vpn_clients`(`username`);

-- CreateIndex
CREATE UNIQUE INDEX `vpn_clients_vpn_type_vpn_ip_key` ON `vpn_clients`(`vpn_type`, `vpn_ip`);

-- AddForeignKey
ALTER TABLE `main_core` ADD CONSTRAINT `main_core_router_nas_id_fkey` FOREIGN KEY (`router_nas_id`) REFERENCES `nas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `harga_paket` ADD CONSTRAINT `harga_paket_ip_pool_id_fkey` FOREIGN KEY (`ip_pool_id`) REFERENCES `ip_pools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daftar_pelanggan` ADD CONSTRAINT `daftar_pelanggan_pppoe_package_id_fkey` FOREIGN KEY (`pppoe_package_id`) REFERENCES `harga_paket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daftar_pelanggan` ADD CONSTRAINT `daftar_pelanggan_router_nas_id_fkey` FOREIGN KEY (`router_nas_id`) REFERENCES `nas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daftar_pelanggan` ADD CONSTRAINT `daftar_pelanggan_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ip_pools` ADD CONSTRAINT `ip_pools_router_nas_id_fkey` FOREIGN KEY (`router_nas_id`) REFERENCES `nas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_deposits` ADD CONSTRAINT `collector_deposits_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_collected_by_user_id_fkey` FOREIGN KEY (`collected_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_payroll_profiles` ADD CONSTRAINT `employee_payroll_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_attendance` ADD CONSTRAINT `employee_attendance_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_team_members` ADD CONSTRAINT `psb_team_members_psb_order_id_fkey` FOREIGN KEY (`psb_order_id`) REFERENCES `psb_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_team_members` ADD CONSTRAINT `psb_team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `areas` RENAME INDEX `areas_name_key` TO `areas_nama_area_key`;

-- RenameIndex
ALTER TABLE `daftar_pelanggan` RENAME INDEX `pppoe_accounts_area_id_idx` TO `daftar_pelanggan_area_id_idx`;

-- RenameIndex
ALTER TABLE `daftar_pelanggan` RENAME INDEX `pppoe_accounts_customer_number_key` TO `daftar_pelanggan_customer_number_key`;

-- RenameIndex
ALTER TABLE `daftar_pelanggan` RENAME INDEX `pppoe_accounts_pppoe_package_id_idx` TO `daftar_pelanggan_pppoe_package_id_idx`;

-- RenameIndex
ALTER TABLE `daftar_pelanggan` RENAME INDEX `pppoe_accounts_router_nas_id_idx` TO `daftar_pelanggan_router_nas_id_idx`;

-- RenameIndex
ALTER TABLE `daftar_pelanggan` RENAME INDEX `pppoe_accounts_username_key` TO `daftar_pelanggan_username_key`;

-- RenameIndex
ALTER TABLE `harga_paket` RENAME INDEX `pppoe_packages_ip_pool_id_idx` TO `harga_paket_ip_pool_id_idx`;

-- RenameIndex
ALTER TABLE `harga_paket` RENAME INDEX `pppoe_packages_name_key` TO `harga_paket_name_key`;

-- Nilai awal hanya ditambahkan jika key belum ada; pengaturan lama dipertahankan.
INSERT INTO `website_settings` (`key`, `value`, `updated_at`) VALUES
 ('billing_start_day', '1', CURRENT_TIMESTAMP(3)),
 ('billing_end_day', '10', CURRENT_TIMESTAMP(3)),
 ('billing_timezone', 'WIB', CURRENT_TIMESTAMP(3)),
 ('isolation_check_hour', '0', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `key` = `website_settings`.`key`;

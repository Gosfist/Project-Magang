-- PT UNZANET - skema database lengkap untuk INSTALASI BARU.
-- Dihasilkan dari backend/prisma/schema.prisma: npm run database:generate
-- Pilih database MySQL KOSONG sebelum mengimpor file ini.
-- Impor sekali saat instalasi awal, bukan saat update aplikasi.
-- Akun awal dibuat terpisah dengan npm run db:seed dari folder backend.
-- Tabel VPN legacy dipertahankan untuk kompatibilitas skema; fitur webnya sudah dihapus.

SET NAMES utf8mb4;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `photo` LONGTEXT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'teknisi',
    `additional_roles` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `main_core` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT UNSIGNED NULL,
    `parent_port_out` INTEGER UNSIGNED NULL,
    `router_nas_id` INTEGER UNSIGNED NULL,
    `nama_titik` VARCHAR(191) NOT NULL,
    `tipe_titik` VARCHAR(191) NOT NULL,
    `redaman_in` DECIMAL(5, 2) NULL,
    `jarak_kabel` DECIMAL(10, 2) NULL,
    `alamat` TEXT NULL,
    `spesifikasi` JSON NULL,
    `tanggal` DATE NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `main_core_nama_titik_key`(`nama_titik`),
    INDEX `main_core_parent_id_idx`(`parent_id`),
    INDEX `main_core_parent_port_out_idx`(`parent_port_out`),
    INDEX `main_core_router_nas_id_idx`(`router_nas_id`),
    INDEX `main_core_tipe_titik_idx`(`tipe_titik`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harga_paket` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(100) NULL,
    `description` VARCHAR(500) NULL,
    `download_mbps` INTEGER UNSIGNED NOT NULL,
    `upload_mbps` INTEGER UNSIGNED NOT NULL,
    `price` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `cost_price` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `address_pool` VARCHAR(191) NULL,
    `ip_pool_id` BIGINT UNSIGNED NULL,
    `validity_days` INTEGER UNSIGNED NOT NULL DEFAULT 30,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `harga_paket_name_key`(`name`),
    INDEX `harga_paket_ip_pool_id_idx`(`ip_pool_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daftar_pelanggan` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_number` BIGINT UNSIGNED NOT NULL,
    `pppoe_package_id` BIGINT UNSIGNED NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `id_card_number` VARCHAR(50) NULL,
    `id_card_photo` LONGTEXT NULL,
    `username` VARCHAR(64) NOT NULL,
    `password` TEXT NOT NULL,
    `phone` VARCHAR(30) NULL,
    `address` TEXT NULL,
    `subscription_type` VARCHAR(10) NOT NULL DEFAULT 'POSTPAID',
    `billing_day` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `discount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `odp` VARCHAR(100) NULL,
    `router_nas_id` INTEGER UNSIGNED NULL,
    `expires_at` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `area_id` BIGINT UNSIGNED NULL,

    UNIQUE INDEX `daftar_pelanggan_customer_number_key`(`customer_number`),
    UNIQUE INDEX `daftar_pelanggan_id_card_number_key`(`id_card_number`),
    UNIQUE INDEX `daftar_pelanggan_username_key`(`username`),
    UNIQUE INDEX `daftar_pelanggan_phone_key`(`phone`),
    INDEX `daftar_pelanggan_pppoe_package_id_idx`(`pppoe_package_id`),
    INDEX `daftar_pelanggan_router_nas_id_idx`(`router_nas_id`),
    INDEX `daftar_pelanggan_area_id_idx`(`area_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `psb_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_number` BIGINT UNSIGNED NOT NULL,
    `customer_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `id_card_number` VARCHAR(50) NULL,
    `id_card_photo` LONGTEXT NULL,
    `address` TEXT NOT NULL,
    `pppoe_package_id` BIGINT UNSIGNED NOT NULL,
    `area_id` BIGINT UNSIGNED NULL,
    `sales_user_id` BIGINT UNSIGNED NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PROCESS',
    `username` VARCHAR(64) NULL,
    `password` TEXT NULL,
    `odp` VARCHAR(100) NULL,
    `router_nas_id` INTEGER UNSIGNED NULL,
    `installation_photo` LONGTEXT NULL,
    `pppoe_account_id` BIGINT UNSIGNED NULL,
    `activated_by_user_id` BIGINT UNSIGNED NULL,
    `completed_by_user_id` BIGINT UNSIGNED NULL,
    `activated_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `installation_fee_paid` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `psb_orders_customer_number_key`(`customer_number`),
    UNIQUE INDEX `psb_orders_phone_key`(`phone`),
    UNIQUE INDEX `psb_orders_id_card_number_key`(`id_card_number`),
    UNIQUE INDEX `psb_orders_pppoe_account_id_key`(`pppoe_account_id`),
    INDEX `psb_orders_status_created_at_idx`(`status`, `created_at`),
    INDEX `psb_orders_sales_user_id_idx`(`sales_user_id`),
    INDEX `psb_orders_pppoe_package_id_idx`(`pppoe_package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_pools` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `network_start` VARCHAR(45) NOT NULL,
    `network_end` VARCHAR(45) NOT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `router_nas_id` INTEGER UNSIGNED NULL,

    UNIQUE INDEX `ip_pools_router_nas_id_name_key`(`router_nas_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pppoe_account_id` BIGINT UNSIGNED NULL,
    `customer_snapshot` JSON NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `base_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `discount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `invoice_type` VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
    `status` VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    `due_date` DATE NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `reminder_sent_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_pppoe_account_id_idx`(`pppoe_account_id`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_addons` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `amount` BIGINT UNSIGNED NOT NULL,
    `fee_type` VARCHAR(15) NOT NULL DEFAULT 'ONCE',
    `notes` TEXT NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_addons_pppoe_account_id_idx`(`pppoe_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_promises` (
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

    INDEX `payment_promises_pppoe_account_id_status_idx`(`pppoe_account_id`, `status`),
    INDEX `payment_promises_status_deadline_idx`(`status`, `deadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radcheck` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `attribute` VARCHAR(64) NOT NULL DEFAULT '',
    `op` CHAR(2) NOT NULL DEFAULT '==',
    `value` VARCHAR(253) NOT NULL DEFAULT '',

    INDEX `radcheck_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radreply` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `attribute` VARCHAR(64) NOT NULL DEFAULT '',
    `op` CHAR(2) NOT NULL DEFAULT '=',
    `value` VARCHAR(253) NOT NULL DEFAULT '',

    INDEX `radreply_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radgroupcheck` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `groupname` VARCHAR(64) NOT NULL DEFAULT '',
    `attribute` VARCHAR(64) NOT NULL DEFAULT '',
    `op` CHAR(2) NOT NULL DEFAULT '==',
    `value` VARCHAR(253) NOT NULL DEFAULT '',

    INDEX `radgroupcheck_groupname_idx`(`groupname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radgroupreply` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `groupname` VARCHAR(64) NOT NULL DEFAULT '',
    `attribute` VARCHAR(64) NOT NULL DEFAULT '',
    `op` CHAR(2) NOT NULL DEFAULT '=',
    `value` VARCHAR(253) NOT NULL DEFAULT '',

    INDEX `radgroupreply_groupname_idx`(`groupname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radusergroup` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `groupname` VARCHAR(64) NOT NULL DEFAULT '',
    `priority` INTEGER NOT NULL DEFAULT 1,

    INDEX `radusergroup_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radacct` (
    `radacctid` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `acctsessionid` VARCHAR(64) NOT NULL DEFAULT '',
    `acctuniqueid` VARCHAR(32) NOT NULL,
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `groupname` VARCHAR(64) NOT NULL DEFAULT '',
    `realm` VARCHAR(64) NULL,
    `nasipaddress` VARCHAR(45) NOT NULL DEFAULT '',
    `nasportid` VARCHAR(32) NULL,
    `nasporttype` VARCHAR(32) NULL,
    `acctstarttime` DATETIME(3) NULL,
    `acctupdatetime` DATETIME(3) NULL,
    `acctstoptime` DATETIME(3) NULL,
    `acctinterval` INTEGER NULL,
    `acctsessiontime` INTEGER UNSIGNED NULL,
    `acctauthentic` VARCHAR(32) NULL,
    `connectinfo_start` VARCHAR(50) NULL,
    `connectinfo_stop` VARCHAR(50) NULL,
    `acctinputoctets` BIGINT UNSIGNED NULL,
    `acctoutputoctets` BIGINT UNSIGNED NULL,
    `calledstationid` VARCHAR(50) NOT NULL DEFAULT '',
    `callingstationid` VARCHAR(50) NOT NULL DEFAULT '',
    `acctterminatecause` VARCHAR(32) NOT NULL DEFAULT '',
    `servicetype` VARCHAR(32) NULL,
    `framedprotocol` VARCHAR(32) NULL,
    `framedipaddress` VARCHAR(45) NOT NULL DEFAULT '',
    `framedipv6address` VARCHAR(45) NOT NULL DEFAULT '',
    `framedipv6prefix` VARCHAR(45) NOT NULL DEFAULT '',
    `framedinterfaceid` VARCHAR(44) NOT NULL DEFAULT '',
    `delegatedipv6prefix` VARCHAR(45) NOT NULL DEFAULT '',
    `class` VARCHAR(64) NULL,

    UNIQUE INDEX `radacct_acctuniqueid_key`(`acctuniqueid`),
    INDEX `radacct_acctsessionid_idx`(`acctsessionid`),
    INDEX `radacct_username_idx`(`username`),
    INDEX `radacct_nasipaddress_idx`(`nasipaddress`),
    INDEX `radacct_acctstarttime_idx`(`acctstarttime`),
    INDEX `radacct_acctstoptime_idx`(`acctstoptime`),
    PRIMARY KEY (`radacctid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radpostauth` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `pass` VARCHAR(64) NOT NULL DEFAULT '',
    `reply` VARCHAR(32) NOT NULL DEFAULT '',
    `authdate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `class` VARCHAR(64) NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vpn_servers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `host` VARCHAR(100) NOT NULL,
    `subnet` VARCHAR(50) NOT NULL DEFAULT '10.200.0.0/24',
    `wg_port` INTEGER UNSIGNED NOT NULL DEFAULT 51820,
    `wg_public_key` TEXT NOT NULL,
    `wg_private_key` TEXT NULL,
    `pool_start` INTEGER UNSIGNED NOT NULL DEFAULT 10,
    `pool_end` INTEGER UNSIGNED NOT NULL DEFAULT 254,
    `gateway` VARCHAR(45) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vpn_clients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `vpn_server_id` BIGINT UNSIGNED NULL,
    `vpn_ip` VARCHAR(45) NOT NULL,
    `client_public_key` TEXT NULL,
    `client_private_key` TEXT NULL,
    `allowed_ips` VARCHAR(100) NOT NULL DEFAULT '10.200.0.0/24',
    `description` TEXT NULL,
    `is_radius_server` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vpn_type` VARCHAR(20) NOT NULL DEFAULT 'legacy',

    INDEX `vpn_clients_vpn_server_id_idx`(`vpn_server_id`),
    INDEX `vpn_clients_vpn_ip_idx`(`vpn_ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NULL,
    `nasname` VARCHAR(128) NOT NULL,
    `shortname` VARCHAR(32) NULL,
    `type` VARCHAR(30) NOT NULL DEFAULT 'mikrotik',
    `ip_address` VARCHAR(45) NULL,
    `ports` SMALLINT UNSIGNED NULL DEFAULT 1812,
    `coa_port` SMALLINT UNSIGNED NOT NULL DEFAULT 3799,
    `radius_server_ip` VARCHAR(45) NULL,
    `vpn_host` VARCHAR(253) NULL,
    `vpn_username` VARCHAR(100) NULL,
    `secret` VARCHAR(60) NOT NULL DEFAULT 'secret',
    `server` VARCHAR(64) NULL,
    `community` VARCHAR(50) NULL,
    `description` VARCHAR(200) NULL DEFAULT 'RADIUS Client',
    `vpn_client_id` BIGINT UNSIGNED NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `require_ma` VARCHAR(4) NOT NULL DEFAULT 'auto',
    `limit_proxy_state` VARCHAR(4) NOT NULL DEFAULT 'auto',
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `nas_nasname_key`(`nasname`),
    INDEX `nas_vpn_client_id_idx`(`vpn_client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nasreload` (
    `nasipaddress` VARCHAR(45) NOT NULL,
    `reloadtime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`nasipaddress`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitoring_errors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` VARCHAR(16) NOT NULL,
    `route` VARCHAR(255) NOT NULL,
    `status` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_name` VARCHAR(255) NOT NULL,
    `role` VARCHAR(30) NOT NULL,
    `module` VARCHAR(40) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `entity_type` VARCHAR(30) NULL,
    `entity_id` VARCHAR(30) NULL,

    INDEX `activity_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `activity_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server_stats` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `recorded_at` DATETIME(3) NOT NULL,
    `cpu_percent` DOUBLE NOT NULL,
    `mem_percent` DOUBLE NOT NULL,
    `mem_used` BIGINT UNSIGNED NOT NULL,
    `mem_total` BIGINT UNSIGNED NOT NULL,
    `net_down` DOUBLE NOT NULL,
    `net_up` DOUBLE NOT NULL,

    INDEX `server_stats_recorded_at_idx`(`recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server_stats_monthly` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `year` SMALLINT UNSIGNED NOT NULL,
    `month` TINYINT UNSIGNED NOT NULL,
    `cpu_percent` DOUBLE NOT NULL,
    `mem_percent` DOUBLE NOT NULL,
    `net_down` DOUBLE NOT NULL,
    `net_up` DOUBLE NOT NULL,
    `samples` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `server_stats_monthly_year_month_key`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `server_stats_yearly` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `year` SMALLINT UNSIGNED NOT NULL,
    `cpu_percent` DOUBLE NOT NULL,
    `mem_percent` DOUBLE NOT NULL,
    `net_down` DOUBLE NOT NULL,
    `net_up` DOUBLE NOT NULL,
    `samples` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `server_stats_yearly_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `areas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama_area` VARCHAR(150) NOT NULL,
    `deskripsi` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `areas_nama_area_key`(`nama_area`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `area_collectors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `area_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `area_collectors_user_id_idx`(`user_id`),
    UNIQUE INDEX `area_collectors_area_id_user_id_key`(`area_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collector_deposits` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pppoe_account_id` BIGINT UNSIGNED NULL,
    `customer_snapshot` JSON NULL,
    `invoice_id` BIGINT UNSIGNED NOT NULL,
    `collector_user_id` BIGINT UNSIGNED NOT NULL,
    `amount` BIGINT UNSIGNED NOT NULL,
    `deposit_date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `accepted_by_user_id` BIGINT UNSIGNED NULL,
    `accepted_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `collector_deposits_pppoe_account_id_idx`(`pppoe_account_id`),
    INDEX `collector_deposits_collector_user_id_idx`(`collector_user_id`),
    INDEX `collector_deposits_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `finance_transactions` (
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
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `finance_transactions_type_idx`(`type`),
    INDEX `finance_transactions_transaction_date_idx`(`transaction_date`),
    INDEX `finance_transactions_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `main_core` ADD CONSTRAINT `main_core_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `main_core`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_pppoe_package_id_fkey` FOREIGN KEY (`pppoe_package_id`) REFERENCES `harga_paket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_sales_user_id_fkey` FOREIGN KEY (`sales_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_activated_by_user_id_fkey` FOREIGN KEY (`activated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_completed_by_user_id_fkey` FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psb_orders` ADD CONSTRAINT `psb_orders_router_nas_id_fkey` FOREIGN KEY (`router_nas_id`) REFERENCES `nas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ip_pools` ADD CONSTRAINT `ip_pools_router_nas_id_fkey` FOREIGN KEY (`router_nas_id`) REFERENCES `nas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_addons` ADD CONSTRAINT `customer_addons_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_promises` ADD CONSTRAINT `payment_promises_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vpn_clients` ADD CONSTRAINT `vpn_clients_vpn_server_id_fkey` FOREIGN KEY (`vpn_server_id`) REFERENCES `vpn_servers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nas` ADD CONSTRAINT `nas_vpn_client_id_fkey` FOREIGN KEY (`vpn_client_id`) REFERENCES `vpn_clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `area_collectors` ADD CONSTRAINT `area_collectors_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `area_collectors` ADD CONSTRAINT `area_collectors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_deposits` ADD CONSTRAINT `collector_deposits_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_deposits` ADD CONSTRAINT `collector_deposits_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_deposits` ADD CONSTRAINT `collector_deposits_collector_user_id_fkey` FOREIGN KEY (`collector_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collector_deposits` ADD CONSTRAINT `collector_deposits_accepted_by_user_id_fkey` FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pengaturan awal sesuai nilai bawaan aplikasi.
INSERT INTO website_settings (`key`, `value`, updated_at) VALUES
  ('billing_start_day', '1', CURRENT_TIMESTAMP(3)),
  ('billing_end_day', '10', CURRENT_TIMESTAMP(3)),
  ('billing_timezone', 'WIB', CURRENT_TIMESTAMP(3)),
  ('isolation_check_hour', '0', CURRENT_TIMESTAMP(3));

-- UNZANET: hapus struktur WireGuard lama, pertahankan klien SSTP.
-- Jalankan SEKALI pada database yang masih mempunyai vpn_servers dan 5 kolom lama.
-- Backup database lengkap dan hentikan backend sebelum menjalankan (DDL auto-commit).
-- Pilih database target terlebih dahulu; file tidak memilih database VPS/lokal otomatis.
-- Foreign key dilepas SEBELUM penghapusan server agar vpn_clients tidak terhapus CASCADE.

-- DropForeignKey
ALTER TABLE `vpn_clients` DROP FOREIGN KEY `vpn_clients_vpn_server_id_fkey`;

-- DropIndex
DROP INDEX `vpn_clients_vpn_server_id_idx` ON `vpn_clients`;

-- AlterTable
ALTER TABLE `vpn_clients` DROP COLUMN `allowed_ips`,
    DROP COLUMN `client_private_key`,
    DROP COLUMN `client_public_key`,
    DROP COLUMN `is_radius_server`,
    DROP COLUMN `vpn_server_id`;

-- DropTable
DROP TABLE `vpn_servers`;

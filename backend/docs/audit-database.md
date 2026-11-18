# Audit pemakaian tabel database UNZANET

Audit 18 November 2026 membandingkan skema Prisma dengan pemakaian pada backend NestJS, kueri SQL, skrip sinkronisasi, installer, serta konfigurasi FreeRADIUS. Tabel kosong tidak dianggap tidak dipakai; acuan penghapusan adalah fungsi aktif dan referensi kode.

## Hasil

Skema aktif memuat 34 tabel dan 33 foreign key. Seluruh tabel yang dipertahankan mempunyai konsumen pada kode atau konfigurasi aktif. `vpn_servers` dihapus karena hanya tersisa sebagai model/relasi WireGuard lama, tanpa konsumen fitur aktif. Lima kolom lama di `vpn_clients` juga dihapus: `vpn_server_id`, `client_public_key`, `client_private_key`, `allowed_ips`, dan `is_radius_server`. Pengisian `allowedIps` pada pembuatan klien dihapus karena alamat/rute SSTP ditentukan oleh konfigurasi SSTP, bukan nilai kolom itu.

`vpn_clients` tetap dipakai untuk akun SSTP. Field `vpn_type` tetap dipakai untuk membedakan data SSTP dan data historis. `radgroupcheck`, `radgroupreply`, dan `nasreload` dipertahankan karena dikonsumsi konfigurasi FreeRADIUS, walaupun tidak seluruhnya diakses layanan NestJS. Tabel statistik harian/bulanan/tahunan server dipertahankan untuk grafik dan rekap monitoring.

## Pembaruan database yang sudah ada

Backup database lengkap dan hentikan backend terlebih dahulu. Jalankan SQL [penghapusan struktur VPN lama](../prisma/updates/20261118-remove-unused-vpn.sql) sekali pada database target yang masih memiliki tabel/kolom lama. Pilih database lewat pengelola MySQL atau `USE nama_database;` sebelum menjalankan file. Skrip melepas foreign key sebelum menghapus tabel server agar aksi cascade tidak menghapus klien. DDL MySQL auto-commit; jangan mengandalkan ROLLBACK. Untuk database dengan struktur berbeda, bandingkan skema terlebih dahulu.

Untuk instalasi baru, `backend/prisma/database.sql` sudah dihasilkan ulang dari skema bersih. Untuk lokal lama yang belum diperbarui sama sekali, jalankan migrasi lokal terdahulu lalu skrip penghapusan VPN lama ini. Pada mesin pengembangan ini, kedua pembaruan sudah diterapkan; jangan jalankan ulang.

Pembersihan diterapkan pada database lokal `unzanet` dan database struktur dokumentasi `unzanet_dokumentasi_20261118`. Database VPS belum diubah. Backup sebelum penghapusan ada di `C:/Users/arema/Documents/UNZANET-Backup/20261118/`, tidak dimasukkan repositori.

## Bukti validasi

- Prisma validate/generate, pemeriksaan database, dan perbandingan penuh skema lokal lolos.
- Uji migrasi pada salinan database dengan dua klien berelasi ke server lama membuktikan kedua baris klien dan seluruh nilai kolom yang dipertahankan tetap sama sesudah penghapusan server.
- Seluruh 434 tes backend serta build backend lolos.
- Screenshot daftar tabel dan struktur `vpn_clients` diambil ulang melalui phpMyAdmin pada database dokumentasi yang sudah bersih. Bab 4.2 diselaraskan dengan 34 tabel; screenshot antarmuka website tetap memakai sumber asli magang.starrcloud.me.

## Referensi pemakaian tabel yang dipertahankan

Tabel berikut menunjukkan contoh konsumen setiap tabel. Model Prisma memakai nama internal yang dapat berbeda dari nama tabel fisik.

| Tabel | Contoh konsumen aktif |
| --- | --- |
| `users` | `backend/src/area/area.controller.ts` |
| `main_core` | `backend/src/home/home.controller.ts` |
| `harga_paket` | `backend/src/psb/psb.service.ts` |
| `daftar_pelanggan` | `backend/src/area/area.service.ts` |
| `psb_orders` | `backend/src/home/home.controller.ts` |
| `ip_pools` | `backend/src/psb/psb.service.ts` |
| `invoices` | `backend/src/area/area.service.ts` |
| `customer_addons` | `backend/src/pppoe/data-pelanggan/customer-services.service.ts` |
| `payment_promises` | `backend/src/area/area.service.ts` |
| `website_settings` | `backend/src/psb/psb.service.ts` |
| `radcheck` | `backend/src/pppoe/isolation/isolation.service.ts` |
| `radreply` | `backend/src/pppoe/isolation/isolation.service.ts` |
| `radgroupcheck` | `scripts/installer-config.py` |
| `radgroupreply` | `scripts/installer-config.py` |
| `radusergroup` | `backend/src/pppoe/shared/radius.service.ts` |
| `radacct` | `backend/src/pppoe/isolation/isolation.service.ts` |
| `radpostauth` | `backend/src/pppoe/data-pelanggan/customer-services.service.ts` |
| `vpn_clients` | `backend/src/router/vpn/vpn.service.ts` |
| `nas` | `backend/src/home/home.controller.ts` |
| `nasreload` | `scripts/installer-config.py` |
| `monitoring_errors` | `backend/src/monitoring/server/server.service.ts` |
| `activity_logs` | `backend/src/pppoe/data-pelanggan/termination.service.ts` |
| `server_stats` | `backend/src/monitoring/server/server-stats.service.ts` |
| `server_stats_monthly` | `backend/src/monitoring/server/server-stats.service.ts` |
| `server_stats_yearly` | `backend/src/monitoring/server/server-stats.service.ts` |
| `areas` | `backend/src/area/area.controller.ts` |
| `area_collectors` | `backend/src/area/area.service.ts` |
| `collector_deposits` | `backend/src/home/home.controller.ts` |
| `finance_transactions` | `backend/src/finance/deposits/finance-deposits.service.ts` |
| `subscription_terminations` | `backend/src/pppoe/data-pelanggan/termination.service.ts` |
| `employee_payroll_profiles` | `backend/src/finance/salary/payroll.service.ts` |
| `employee_attendance` | `backend/src/finance/salary/payroll.service.ts` |
| `employee_leaves` | `backend/src/finance/salary/payroll.service.ts` |
| `psb_team_members` | `backend/src/psb/psb.service.ts` |

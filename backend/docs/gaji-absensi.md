# Gaji karyawan bonus PSB dan absensi

## Alur Finance

1. Buka Finance > Gaji. Pilih bulan WIB. Total di bagian atas menjumlahkan gaji bersih karyawan, bonus PSB tim, dan gaji Sales per pemasangan. Nilai bulan berjalan masih estimasi, bukan bukti transfer atau pencatatan pembayaran gaji.
2. Pada Gaji Karyawan, klik Atur Gaji per akun. Pilih bulanan/harian, nominal, tanggal mulai menghitung hari tanpa absen, jatah libur bulanan, serta pilihan dan nominal potongan keterlambatan/kelebihan libur. Perubahan gaji disimpan per periode mulai tanggal 1 dan diteruskan sampai ada versi berikutnya. Mengedit periode lama mengubah perhitungan periode itu.
3. Tanggal mulai menghitung ketidakhadiran default hari ini agar pemasangan fitur di tengah bulan tidak langsung memotong gaji untuk hari sebelum fitur digunakan. Finance dapat menyesuaikan tanggal tersebut. Gaji bulanan akun yang dibuat di tengah bulan diprorata menurut hari kalender sejak akun dibuat. Akun yang memiliki riwayat absensi/gaji/tim PSB tidak dapat dihapus; gunakan status nonaktif untuk mempertahankan riwayat. Akun nonaktif tidak otomatis kehilangan hak gaji yang tercatat; Finance perlu menyimpan nominal 0 pada periode penghentian gaji.
4. Gaji bulanan: gaji pokok dikurangi potongan yang diaktifkan. Libur dalam jatah tidak dipotong; kelebihan hari dikalikan nominal potongan per hari. Potongan terlambat dihitung per kejadian jika diaktifkan. Potongan pulang awal bulanan opsional dengan nominal per kejadian. Potongan hanya mengurangi gaji pokok sampai minimum 0; tidak memotong bonus PSB atau gaji Sales.
5. Gaji harian: hari yang memiliki check-in dibayar satu tarif harian. Hari tidak masuk/libur tidak dibayar meskipun masih ada jatah libur. Pulang awal dipotong proporsional terhadap menit yang tersisa sampai jam pulang dibagi durasi jadwal kerja. Contoh jadwal 08:00?17:00, tarif Rp100.000, checkout 12:30 menghasilkan potongan Rp50.000. Potongan terlambat tetap mengikuti pilihan Finance secara terpisah.
6. Pada Bonus dan Gaji Sales, atur total biaya/bonus PSB serta gaji Sales per pemasangan. Nilai biaya PSB tetap sama dengan pengaturan Administrator. Untuk pemasangan baru yang diselesaikan, nominal bonus per anggota dan gaji Sales disimpan agar perubahan tarif berikutnya tidak mengubah pembagian lama.
7. Pada Pengaturan Absensi, atur mulai boleh check-in, batas tepat waktu, jam pulang, jam checkout otomatis, dan hari kerja. Semua jam WIB, dalam satu hari, dengan urutan masuk <= batas terlambat < pulang <= checkout otomatis. Jadwal berlaku mulai periode terpilih dan diteruskan ke periode berikutnya. Absensi yang sudah masuk memakai jadwal yang disimpan saat check-in.
8. Pada Absensi dan Libur, Finance melihat tanggal, karyawan, jam masuk/pulang, keterlambatan dan sumber checkout otomatis/manual. Filter tanggal/karyawan tersedia; daftar dibatasi 1.000 baris dan menampilkan jumlah total. Libur dicatat langsung oleh Finance. Tanggal yang sudah memiliki absensi tidak bisa dicatat libur. Menghapus catatan libur tidak menghapus ketidakhadiran otomatis.
9. Hari kerja teknisi yang tidak memiliki check-in dihitung libur hanya setelah jam checkout otomatis hari tersebut, mulai tanggal pemantauan yang diatur. Hari mendatang dan hari libur mingguan di luar jadwal tidak dihitung mangkir. Catatan libur dan hari tanpa absen pada tanggal yang sama dihitung satu kali. Untuk peran nonteknisi, libur berasal dari catatan Finance karena absensi mandiri saat ini ditujukan ke teknisi.

## Alur teknisi dan tim PSB

1. Dashboard teknisi menampilkan Absen Masuk, Absen Pulang, serta rincian gaji/bonus. Check-in sebelum waktu dibuka atau setelah jam pulang ditolak oleh server. Jam dari HP/browser tidak digunakan sebagai waktu absensi. Checkout manual boleh lebih awal dan mengikuti potongan yang berlaku.
2. Jika belum checkout sampai batas otomatis, backend menutup absensi pada jam otomatis yang disimpan di baris tersebut. Pemeriksaan berjalan setiap menit dan saat data absensi dibuka. Setelah downtime, server memproses absensi tertunda dengan waktu checkout terjadwal, bukan waktu server kembali menyala. Halaman teknisi tidak harus terbuka; backend harus berjalan.
3. Di akhir form aktivasi PSB, pilih Tim PSB. Akun yang melakukan aktivasi selalu termasuk; pilih teknisi aktif lain yang ikut. Admin yang mengerjakan aktivasi juga dapat menjadi anggota tim. Bonus baru diakui setelah pemasangan diselesaikan.
4. Biaya PSB dibagi rata ke seluruh anggota. Contoh Rp100.000 untuk 3 orang dibagi Rp33.334, Rp33.333, Rp33.333; sisa rupiah diberikan menurut urutan ID anggota agar jumlah persis sama. Teknisi lain yang menekan Selesai tidak otomatis menggantikan tim atau menerima seluruh bonus.
5. Anggota tim dapat melihat PSB yang diikutinya. Tim masih dapat disesuaikan sebelum selesai, tetapi tidak setelah selesai. Perubahan tim dan penyelesaian dilindungi transaksi dan lock pesanan untuk mencegah pembagian ganda atau perubahan saat sedang diselesaikan.
6. PSB lama yang belum mempunyai tim tetap dihitung untuk completedByUserId lama, berdasarkan biaya pemasangan yang tersimpan (atau tarif PSB jika nominal historis kosong). Jangan menebak anggota tim pemasangan lama yang tidak tercatat. Upgrade mengisi gaji Sales historis yang kosong menggunakan tarif saat upgrade; tarif historis sebelum fitur ini memang tidak disimpan.

## Instalasi baru

Skema baru sudah ada di backend/prisma/schema.prisma dan backend/prisma/database.sql. Instalasi kosong memakai alur biasa. Jangan mengimpor database.sql ke database yang berisi data.

## Update VPS yang sudah berisi data

1. Backup database melalui prosedur backup yang biasa digunakan. Ambil kode dan paket frontend terbaru. Jalankan SQL tambahan di bawah pada database aplikasi sebelum backend versi baru diaktifkan. Perintah hanya menambah empat tabel dan kolom sales_commission; tidak menghapus pelanggan atau transaksi. CREATE IF NOT EXISTS dapat diulang untuk tabel yang belum lengkap terpasang, tetapi tidak memperbaiki tabel custom yang berbeda skema.
2. Di SSH VPS Ubuntu:

```bash
cd /var/www/Project-Magang
git pull --ff-only
cd backend
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
SET @payroll_column_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'psb_orders'
      AND COLUMN_NAME = 'sales_commission'),
  'SELECT 1',
  'ALTER TABLE psb_orders ADD COLUMN sales_commission BIGINT UNSIGNED NULL'
);
PREPARE payroll_column_stmt FROM @payroll_column_sql;
EXECUTE payroll_column_stmt;
DEALLOCATE PREPARE payroll_column_stmt;
CREATE TABLE IF NOT EXISTS `employee_payroll_profiles` (
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
    PRIMARY KEY (`id`),
    CONSTRAINT `employee_payroll_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_attendance` (
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
    PRIMARY KEY (`id`),
    CONSTRAINT `employee_attendance_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_leaves` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `work_date` DATE NOT NULL,
    `note` VARCHAR(500) NOT NULL DEFAULT '',
    `recorded_by_user_id` BIGINT UNSIGNED NOT NULL,

    UNIQUE INDEX `employee_leaves_user_id_work_date_key`(`user_id`, `work_date`),
    PRIMARY KEY (`id`),
    CONSTRAINT `employee_leaves_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `psb_team_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `psb_order_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `bonus_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `psb_team_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `psb_team_members_psb_order_id_user_id_key`(`psb_order_id`, `user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `psb_team_members_psb_order_id_fkey` FOREIGN KEY (`psb_order_id`) REFERENCES `psb_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `psb_team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE psb_orders
SET sales_commission = CAST(COALESCE(
  (SELECT value FROM website_settings WHERE `key` = 'gaji_sales'), '0') AS UNSIGNED)
WHERE status = 'COMPLETED' AND sales_commission IS NULL;
SQL
```

3. Periksa skema dan lanjutkan update. Jika pemeriksaan menolak index unik subscription_terminations lama, ikuti panduan berhenti-langganan.md terlebih dahulu; jangan impor ulang database.sql.

```bash
cd /var/www/Project-Magang/backend
npm run prisma:generate
cd /var/www/Project-Magang
npm run database:verify
npm run update
```

4. Uji Finance dan teknisi dengan akun masing-masing: gaji per akun, check-in sebelum waktu ditolak, terlambat, checkout awal, checkout otomatis, libur melebihi jatah dengan toggle aktif/nonaktif, tim PSB 3 orang, dan total Finance. Validasi lokal build/test bukan bukti absensi, pembayaran, atau database VPS sudah diuji.

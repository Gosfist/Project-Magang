# Pembaruan database lokal 18 November 2026

Pembersihan lanjutan: jalankan `20261118-remove-unused-vpn.sql` sesudah migrasi lokal pertama pada database yang masih memiliki tabel VPN lama. Keduanya sudah diterapkan pada lokal ini. Rincian dan validasi tersedia pada [audit database](../../docs/audit-database.md). Skema terbaru memiliki 34 tabel; migrasi pertama menyimpan keadaan skema sebelum pembersihan VPN.

File `20261118-local-schema.sql` khusus untuk struktur database lokal `unzanet` lama yang diperiksa pada 18 November 2026, menggunakan MySQL 8.4.3. File ini bukan migrasi universal dan belum dibandingkan dengan database VPS.

Database lokal tersebut sudah diperbarui. Jangan jalankan file SQL ini lagi pada database yang sudah diperbarui. File tidak idempotent; setiap perintah dijalankan sekali. Jangan impor `../database.sql` untuk memperbarui database yang berisi data karena file itu untuk instalasi baru.

## Perubahan

- Tabel pelanggan, paket, dan pengaturan diganti nama menjadi `daftar_pelanggan`, `harga_paket`, dan `website_settings`, dengan isi dan ID dipertahankan.
- Nama kolom wilayah diperbarui tanpa membuat ulang datanya.
- Kolom, indeks, dan relasi ditambahkan untuk fitur terkini, termasuk Main Core, pelanggan, invoice, VPN, berhenti langganan, absensi, dan penggajian.
- Struktur/data yang tidak lagi dipakai diarsipkan dalam database `unzanet_arsip_20261118` sebelum dikeluarkan dari skema aktif.
- Pengaturan awal ditambahkan hanya jika key belum ada. Password pengguna dan JWT_SECRET tidak diubah.

## Memakai SQL pada salinan database lama yang sama

1. Hentikan backend dan buat backup lengkap database terlebih dahulu. DDL MySQL melakukan auto-commit sehingga tidak dapat dibatalkan dengan ROLLBACK.
2. Pastikan struktur awal masih sama dengan database lokal lama: tabel `pppoe_accounts`, `pppoe_packages`, dan `app_settings` masih ada; tabel penggantinya belum ada. Database arsip dengan nama di atas juga belum boleh ada. Perbedaan struktur lain harus dibandingkan sebelum menjalankan SQL ini.
3. Buka file SQL, salin seluruh isinya ke tab SQL pengelola MySQL, lalu jalankan sekali. File memilih database `unzanet` secara eksplisit dan memerlukan izin membuat database arsip.
4. Jalankan `npm.cmd run database:verify` dari root proyek. Untuk perbandingan lengkap, dari folder backend jalankan `node node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`. Hasil yang diharapkan: `No difference detected.`

## Bukti validasi lokal

SQL diuji lebih dahulu pada salinan database sebelum diterapkan ke `unzanet`. Jumlah baris semua tabel lama diperiksa kembali (dengan pemetaan nama baru/arsip); kedua akun pengguna beserta nilai kolom lamanya tetap sama. Pengaturan awal baru ditambahkan. Pemeriksaan skema aplikasi dan perbandingan lengkap Prisma lolos setelah pembaruan. Tidak ada pembaruan database VPS pada pekerjaan ini.

Backup sebelum pembaruan disimpan di luar repositori: `C:/Users/arema/Documents/UNZANET-Backup/20261118/unzanet-sebelum-update.sql`. Backup berisi data/kredensial dan tidak boleh dimasukkan Git.

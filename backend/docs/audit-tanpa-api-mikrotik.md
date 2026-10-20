# Audit kode tanpa API MikroTik

Pemeriksaan lokal 20 Oktober 2026 tidak menemukan koneksi RouterOS API TCP
8728/8729, RouterOS REST, SSH/Telnet ke router, atau polling SNMP dalam kode
aplikasi aktif. Tidak ditemukan dependensi `node-routeros`, `routeros-client`,
`routeros-api`, atau klien SNMP pada manifest dan lockfile aplikasi.

## Cakupan dan hasil

| Bagian | Jalur yang dipakai saat ini |
| --- | --- |
| Harga Paket | `RadiusService.sync()` menulis `Mikrotik-Rate-Limit` dan `Framed-Pool`. Perubahan kecepatan/pool menyinkronkan RADIUS sebelum meminta reconnect. Harga billing tetap di database aplikasi. |
| IP Pool | Metadata/rentang per NAS disimpan di database. Tambah/edit/hapus menghasilkan script manual; tidak membaca atau mengubah pool melalui jaringan. Pemakaian/sisa IP pada perangkat tidak diverifikasi. |
| Isolir | Script memasang pool, profil, dan firewall. Konfirmasi operator dengan fingerprint script mengaktifkan pengaturan RADIUS. Sesi yang perlu berpindah IP ditargetkan melalui accounting dan Disconnect-Request. |
| Putus sesi | `PppoeNetworkService` memakai `RadiusDisconnectService`, socket UDP, shared secret RADIUS, serta identitas sesi accounting. Balasan ACK/NAK divalidasi dan kegagalan masuk antrean ulang. |
| Status pelanggan dan PSB | Sumbernya `radacct` dengan batas kesegaran; tidak membaca `/ppp active` melalui API. |
| Pembayaran, janji bayar, dan billing | Pemulihan/status akun menyinkronkan atribut RADIUS dan menggunakan jalur Disconnect yang sama. |
| Router/NAS | Controller hanya mengelola metadata NAS dan script. DTO/form tidak menerima kredensial atau port login API router. |
| Status VPN | Worker menjalankan perintah lokal `accel-cmd show sessions`; backend membaca snapshot file lokal. Tidak login ke MikroTik. |
| Backup | Script RouterOS dan Excel dibuat dari database. Unduhan tidak menghubungi router. Perintah RouterOS di dalam file baru dijalankan ketika operator memasangnya. |
| Monitoring | Monitoring sumber daya server aplikasi dan log RADIUS; tidak ada controller/provider monitoring API router. |
| Frontend dan bot WhatsApp | HTTP API yang dipanggil adalah API aplikasi/bot. Tidak ada koneksi langsung ke API router. |
| Installer/updater | Mengelola layanan lokal VPS, SQL NAS, FreeRADIUS, dan SSTP. `simul_verify_query` dikosongkan agar pengecekan sesi tidak menjalankan checkrad/SNMP. |
| Skema database | Model NAS/SQL instalasi baru tidak memiliki username/password/port login API MikroTik atau tabel statistik API router. |
| Paket frontend | `python scripts/frontend-prebuilt.py --check` menyatakan paket lokal valid terhadap source frontend saat audit. |

Perubahan sesudah audit: pengaturan pool/isolir kini berada pada Tambah/Edit NAS
dengan input gateway/prefix dan konfirmasi pemasangan di dialog script. Pool
internet pelanggan mengikuti NAS setelah dikonfirmasi. Hasil tes/paket frontend
pada tabel audit adalah snapshot sebelum perubahan UI ini; paket deployment
perlu dibuat ulang setelah source frontend disimpan ke commit.

Pemeriksaan mencakup source backend/frontend/bot, module/controller dan pemanggil
layanan jaringan, script deployment, skema Prisma/SQL, contoh environment,
manifest/lockfile, serta dokumentasi aktif. Library pihak ketiga dan histori Git
bukan kode aplikasi aktif. Nilai environment rahasia tidak dicetak atau diubah.

Angka `8728` yang masih ada di tes Router/NAS adalah input negatif untuk
memastikan field API lama dibuang oleh validasi HTTP. `ApiService`, endpoint
`/api`, dan API key bot adalah bagian komunikasi aplikasi sendiri. Nama atribut
`Mikrotik-*` adalah atribut RADIUS, bukan klien RouterOS API. Kolom `community`
bawaan skema NAS tidak dibaca atau dikirim oleh runtime aplikasi.

## Koreksi dokumentasi

`backend/src/README.md` masih menunjuk migrasi lama
`prisma/updates/20261018_zero_mikrotik_api.sql` yang sudah tidak tersedia.
Petunjuk tersebut diperbaiki: skema aktif berada di `prisma/database.sql` untuk
database kosong; updater tidak memigrasikan skema database lama. Panduan
instalasi utama sudah memuat ketentuan yang sama.

Tidak diperlukan penggantian transport runtime pada audit ini: alur aplikasi
yang diperiksa sudah menggunakan RADIUS dan script manual.

## Validasi lokal

| Pemeriksaan | Hasil |
| --- | --- |
| Build backend | Lulus |
| Build frontend produksi | Lulus |
| Unit test backend | 42 berkas, 291 tes lulus |
| Frontend ChromeHeadless | 270 tes lulus |
| Otorisasi bot WhatsApp | 7 tes lulus |
| Worker VPN/status dan generator SQL | 8 tes lulus |
| Installer, paket frontend, refresh NAS, dan konfigurasi | 53 tes: 51 lulus, 2 symlink Linux dilewati di Windows |
| Validasi paket frontend lokal | Lulus |

Audit ini tidak memeriksa versi yang sedang berjalan di VPS, isi database
produksi, layanan API yang masih diaktifkan pada router, atau integrasi aplikasi
lain. Belum menjadi bukti dial PPPoE, accounting, batas kecepatan, isolir,
pemulihan, atau Disconnect pada MikroTik nyata. Kode lokal tidak memerlukan
layanan API MikroTik; pemasangan dan operasi RADIUS tetap harus diuji pada NAS.

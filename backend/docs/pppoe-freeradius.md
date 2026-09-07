# Rancangan PPPoE Laravel, FreeRADIUS, dan MikroTik

## Alur sistem

1. Laravel mengelola paket dan akun PPPoE di MySQL.
2. Laravel menyinkronkan akun aktif ke `radcheck` dan `radreply` dalam transaksi yang sama.
3. CHR mengirim permintaan autentikasi PPPoE ke FreeRADIUS melalui UDP 1812 dan accounting ke UDP 1813.
4. FreeRADIUS membaca kredensial dan atribut paket dari MySQL.
5. CHR menerapkan `Mikrotik-Rate-Limit`, `Framed-Pool`, dan mengirim sesi ke `radacct`.

Kecepatan disimpan sebagai upload/download dari sudut pandang pelanggan, lalu dikirim ke RouterOS sebagai `uploadM/downloadM` karena RX/TX pada atribut MikroTik dibaca dari sisi router.

## Tahap lab VM

- VM Ubuntu: Laravel, Nginx, PHP, MySQL, dan FreeRADIUS.
- CHR server: PPPoE server dan RADIUS client.
- CHR modem/client: PPPoE client untuk pengujian.
- Gunakan jaringan management terpisah dari jaringan pelanggan bila memungkinkan.
- Pastikan waktu semua VM sinkron dengan NTP.

Setelah migrasi Laravel dijalankan, arahkan modul SQL FreeRADIUS ke database Laravel yang sama. Aktifkan modul `sql` pada site FreeRADIUS, lalu daftarkan alamat CHR sebagai RADIUS client. Secret RADIUS harus panjang, acak, sama di kedua sisi, dan tidak dimasukkan ke Git.

Contoh inti di RouterOS (ganti nilai contoh):

```routeros
/radius add service=ppp address=IP_UBUNTU secret=SECRET_YANG_KUAT authentication-port=1812 accounting-port=1813
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
```

Pastikan username uji tidak terdapat di `/ppp secret`, karena RouterOS memeriksa database lokal sebelum RADIUS. Nama IP pool yang diisi pada Paket PPPoE juga harus sudah ada di `/ip pool` pada CHR.

## Keamanan sebelum produksi

- Batasi UDP 1812/1813 di firewall Ubuntu hanya dari IP CHR.
- Buat user MySQL khusus FreeRADIUS dengan hak minimum: baca tabel otorisasi, tulis tabel accounting/post-auth.
- Jangan membuka MySQL ke internet publik; gunakan private network atau tunnel saat Ubuntu dipindah ke VPS.
- Simpan backup database dan `APP_KEY`. Kolom password di tabel aplikasi dienkripsi dengan `APP_KEY`.
- `radcheck` berisi `Cleartext-Password` agar autentikasi PPP/CHAP dapat bekerja; lindungi akses database dan backup dengan ketat.
- Uji dengan `freeradius -X` atau mode debug yang sesuai sebelum menjadikannya service produksi.

## Urutan pengujian

1. Tambah Paket PPPoE dan Akun PPPoE dari dashboard.
2. Pastikan baris akun muncul di `radcheck` dan atribut paket muncul di `radreply`.
3. Jalankan tes autentikasi lokal FreeRADIUS.
4. Tes login dari CHR client ke CHR PPPoE server.
5. Pastikan sesi masuk ke `radacct` dan limit upload/download sesuai.
6. Nonaktifkan akun dari Laravel dan pastikan login baru ditolak.
7. Baru setelah lab stabil, pindahkan Ubuntu ke VPS dan konfigurasi ulang hanya IP, firewall, DNS/TLS, dan RADIUS client.

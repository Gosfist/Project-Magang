# Antarmuka UNZANET

Redesain 8 November 2026 menggunakan skill `ui-ux-pro-max` dengan arah antarmuka operasional yang bersih dan profesional. Palet navy, biru, putih, cyan, serta warna status yang sudah ada dipertahankan.

## Aturan visual

- Gunakan token `--ui-*` di `src/styles.css`. Font sistem Segoe UI tidak membutuhkan layanan font eksternal.
- Halaman dashboard memakai host `workspace-page` untuk gaya bersama tabel, formulir, kartu, tombol, dan pagination.
- Gunakan border tipis, radius 6–8 px, dan jarak 16–24 px. Bayangan hanya untuk lapisan yang mengambang seperti dialog.
- Judul memakai bobot 600; nominal dan jumlah memakai angka tabular. Warna status selalu disertai teks.
- Pertahankan kontrol filter, pengurutan, pencarian, aksi, serta hak akses setiap role.
- Tabel lebar bergulir di dalam wadahnya, bukan membuat seluruh halaman bergeser horizontal.
- Pesan tabel kosong pada ponsel rata kiri agar tetap terlihat sebelum pengguna menggulir tabel.
- Fokus keyboard tetap terlihat, kontrol ikon mempunyai nama aksesibel, dan animasi mengikuti preferensi pengurangan gerakan.

## Cakupan

Landing page memakai hero dua kolom, gambar merek yang sudah ada, daftar manfaat, paket dari API, dan kontak. Login memakai panel merek serta formulir yang mendukung password manager. Dashboard administrator memakai ringkasan operasional, finance, bot, akses cepat, dan jaringan. Halaman seluruh role dan fitur memakai aturan workspace bersama.

## Validasi lokal

Jalankan `npm.cmd run build` dan `npm.cmd test -- --watch=false --browsers=ChromeHeadless` dari folder `frontend`. Pemeriksaan browser dengan data simulasi lokal tidak membuktikan koneksi API produksi atau perangkat jaringan.

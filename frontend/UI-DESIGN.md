# Antarmuka UNZANET

Redesain 8 November 2026 menggunakan skill `ui-ux-pro-max` dengan arah antarmuka operasional yang bersih dan profesional. Palet navy, biru, putih, cyan, serta warna status yang sudah ada dipertahankan.

## Aturan visual

- Gunakan token `--ui-*` di `src/styles.css`. Font sistem Segoe UI tidak membutuhkan layanan font eksternal.
- Halaman dashboard memakai host `workspace-page` untuk gaya bersama tabel, formulir, kartu, tombol, dan pagination.
- Gunakan border tipis, radius 6–8 px, dan jarak 16–24 px. Bayangan hanya untuk lapisan yang mengambang seperti dialog.
- Judul memakai bobot 600; nominal dan jumlah memakai angka tabular. Warna status selalu disertai teks.
- Pertahankan kontrol filter, pengurutan, pencarian, aksi, serta hak akses setiap role.
- Sidebar, header tabel, dan tombol utama dashboard (termasuk Tambah) memakai token navy yang sama (`--ui-navy`: `#020617`) dengan teks putih. Berlaku juga untuk tabel dalam dialog dan header sticky.
- Tabel lebar bergulir di dalam wadahnya, bukan membuat seluruh halaman bergeser horizontal.
- Pesan tabel kosong pada ponsel rata kiri agar tetap terlihat sebelum pengguna menggulir tabel.
- Fokus keyboard tetap terlihat, kontrol ikon mempunyai nama aksesibel, dan animasi mengikuti preferensi pengurangan gerakan.

## Cakupan

Hanya hero landing page mengikuti tampilan sebelum redesain, dengan gambar latar lebar dan teks di atasnya. Navbar tetap memakai desain baru. Daftar manfaat, paket dari API, dan kontak tetap memakai desain baru. Login memakai panel merek serta formulir yang mendukung password manager. Dashboard administrator memakai ringkasan operasional, finance, bot, akses cepat, dan jaringan. Halaman seluruh role dan fitur memakai aturan workspace bersama.

## Validasi lokal

Jalankan `npm.cmd run build` dan `npm.cmd test -- --watch=false --browsers=ChromeHeadless` dari folder `frontend`. Pemeriksaan browser dengan data simulasi lokal tidak membuktikan koneksi API produksi atau perangkat jaringan.

## Preview WhatsApp

Log notifikasi menampilkan nomor target dan badge status tanpa ikon titik tambahan. Modal detail memakai dua kolom mulai 768 px: detail pengiriman di kiri, isi pesan di kanan; layar kecil memakai satu kolom. Isi pesan dan preview template memakai wallpaper lokal serta gelembung pesan hijau muda dengan teks gelap. Pesan panjang tetap membungkus dan modal dapat digulir.

Wallpaper: `public/assets/images/whatsapp-chat-wallpaper.jpg`, diunduh dari [pin referensi pengguna](https://id.pinterest.com/pin/1047931407026339311/) melalui gambar asli Pinterest. Wallpaper disajikan dari aset lokal.

# Konfirmasi tindakan di antarmuka

Konfirmasi penghapusan menggunakan modal aplikasi yang sama tampilannya dengan
Hapus Klien VPN: judul, tombol tutup, pesan, tombol Batal, dan tombol Hapus merah.
Jangan memakai dialog bawaan browser `window.confirm`, `window.alert`, atau
`window.prompt` untuk alur antarmuka aplikasi.

Konfirmasi bersama diterapkan pada Server, Rasio, ODC, ODP, Data Area,
penugasan kolektor, Data Petugas, Router, Paket Layanan,
pendaftaran IP Pool, dan catatan Transaksi Finance. Modal VPN yang sudah sesuai
tetap menggunakan tampilannya yang ada. Notifikasi sukses/gagal memakai toast.

Permintaan hapus baru dikirim setelah pengguna menekan Hapus. Batal, tombol X,
klik latar gelap, Escape, dan perpindahan halaman membatalkan konfirmasi yang
masih terbuka. Klik berulang saat menunggu konfirmasi tidak membuat dialog kedua.
Fokus awal berada pada Batal, Tab tetap di dalam dialog, dan fokus dikembalikan
ke pemicu saat dialog ditutup.

Untuk menambahkan konfirmasi penghapusan baru, injeksikan `ConfirmationService`
dan tunggu `ask(judul, pesan)` sebelum memanggil API. Host `app-confirmation`
dipasang satu kali di root aplikasi dan memakai `ModalComponent` yang sama
dengan halaman VPN. Teks pesan diinterpolasi sebagai teks, bukan HTML.

Lokasi implementasi: `frontend/src/app/core/services/confirmation.service.ts`
dan `frontend/src/app/shared/components/confirmation/confirmation.component.ts`.

Data pelanggan dan registrasi PSB tidak memiliki aksi hapus. Gunakan
[Teknisi > Berhenti Langganan](berhenti-langganan.md) untuk penghentian permanen.

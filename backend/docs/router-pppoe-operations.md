# Router dan PPPoE tanpa API MikroTik

## Router dan script

Kolom Status VPN pada daftar NAS berasal dari sesi SSTP server: username dan IP harus cocok pada sesi active. Daftar sesi kosong berarti Offline, bukan berdasarkan isActive NAS. Worker membaca Accel-PPP setiap 10 detik; web memuat ulang daftar setiap 15 detik. Pembacaan gagal atau snapshot lebih dari 45 detik tampil Tidak diketahui, akun eksternal juga Tidak diketahui, dan NAS lokal tampil Tanpa VPN. Web hanya membaca snapshot lokal tanpa akses sudo/CLI atau API MikroTik. Status VPN bukan bukti dial PPPoE pelanggan.

Buat akun melalui Router > Klien VPN. Server SSTP berjalan pada VPS website/FreeRADIUS yang sama, TCP 4443. Akun mendapat IP unik 10.88.0.2-254, server RADIUS 10.88.0.1. Worker root menerapkan akun sekitar 15 detik. Siap berarti akun diterapkan, belum berarti tunnel online. Password tersimpan terenkripsi dan dapat ditampilkan administrator; endpoint kredensial tidak di-cache.

Pada tambah/edit NAS pilih klien VPN yang Siap dan belum dipakai router lain. IP sumber RADIUS, tujuan Disconnect, host, dan username berasal dari akun. Password otomatis dimasukkan dalam script tanpa disalin ke tabel NAS. Tidak ada impor CA pada script sederhana. Satu klien untuk satu router juga ditegakkan database. Kredensial API/admin MikroTik tidak digunakan.

Simpan membuka script SSTP port 4443, RADIUS/Disconnect, PPP AAA/accounting, kedua pool/profil PPP dan firewall isolir. Tambah menghasilkan add; Edit menghasilkan set untuk konfigurasi terpasang dan add untuk pool/profil baru. Semua perintah langsung tanpa if. Verifikasi sertifikat server dimatikan pada mode sederhana. Script unduhan tidak dieksekusi aplikasi. Uji tunnel dan PPPoE nyata tetap diperlukan; NAS lokal tetap didukung.

Worker root terpisah menerapkan perubahan client SQL sekitar setiap 60 detik setelah config check. Web tidak diberi sudo. Lihat [panduan instalasi](instalasi-ubuntu-vpn.md).

## IP Pool

Submenu IP Pool dan Isolir PPPoE dipindahkan ke Tambah/Edit Router NAS; URL lama mengarah ke Router / NAS. Isi IP Pool Internet dan IP Pool Isolir dengan gateway/prefix, misalnya 192.168.75.1/24 dan 192.168.100.1/24. Rentang otomatis mengecualikan network, broadcast, dan gateway. Subnet tidak boleh tumpang tindih atau mencakup IP NAS/RADIUS. Pool bernama Internet dan pool-isolir pada setiap NAS, profilnya UNZANET-INTERNET-ID dan UNZANET-ISOLIR-ID.

Klik Salin Script lalu paste ke Terminal Winbox. Pool lama bernama Internet yang sudah terdaftar digunakan kembali melalui set; profil internet baru dibuat melalui add. Pastikan rule drop isolir berada sebelum accept/FastTrack. Centang pernyataan pemasangan lalu Konfirmasi Pemasangan di dialog script. Konfirmasi ini adalah pemeriksaan operator, bukan pembacaan perangkat oleh backend.

Draft dan prefix terkonfirmasi disimpan terpisah pada AppSetting. Simpan/Edit tidak langsung mengganti pool RADIUS aktif. Konfirmasi fingerprint terbaru mengaktifkan prefix dan menjadwalkan sinkronisasi sesi, termasuk reconnect normal ketika gateway/subnet internet berubah. Harga Paket mengatur harga/kecepatan/masa aktif; RADIUS memakai pool/profil NAS pelanggan. NAS lama tanpa prefix terkonfirmasi tetap memakai referensi pool paket lama. Penggunaan/sisa IP router tidak dipantau; tidak ada /ip/pool/used atau polling SNMP.

## Perubahan pelanggan dan pemutusan sesi

Perubahan akun, paket, status dan atribut RADIUS diselesaikan dalam transaksi sebelum Disconnect Request dikirim. Sasaran menggunakan NAS terdaftar dan identitas username/sesi accounting. Respons diperiksa autentikatornya dan ditangani sebagai ACK, NAK, atau timeout. Kegagalan perangkat tidak membatalkan status yang sudah tersimpan.

Putus Sesi dapat dicoba ulang. Akun aktif bisa menyambung kembali setelah disconnect manual. Backend tidak mengarang Accounting Stop; NAS tetap menjadi sumber Start/Stop/Interim. Signed ACK/NAK 503 memiliki penanda per sesi agar accounting yang terlambat tidak menahan reconnect. Isolir/pemulihan pool memerlukan reconnect untuk menerima IP baru.

Status online adalah hasil accounting yang masih segar. Default RADIUS_ACCOUNTING_STALE_SECONDS 900 detik cocok dengan update 5 menit. RADIUS_ACCOUNTING_TIMEZONE harus sesuai DATETIME yang ditulis SQL; installer baru menggunakan WIB. Data stale ditampilkan sebagai tidak pasti.

## Form pelanggan dan tagihan

Form pelanggan/foto KTP, pemilihan ODP, kepemilikan role, serta workflow pembayaran tidak berubah karena transport router diganti. Edit pelanggan tidak membuat invoice pertama baru. Mode tagihan none tidak membuat invoice; full memakai harga penuh; prorate berlaku untuk POSTPAID sedangkan PREPAID tetap penuh.

## Instalasi baru dan validasi

Instalasi baru memakai database.sql pada database kosong pada VPS baru. Skema ini sudah tidak memiliki kolom kredensial API NAS atau tabel statistik router. Tidak ada migrasi terpisah. Jika layanan lain tidak menggunakan API, nonaktifkan layanan api/api ssl pada perangkat secara manual setelah memeriksa integrasi lain.

Tes script, database tiruan, dan UDP lokal tidak membuktikan NAS nyata. Uji dial pelanggan, accounting, Disconnect, isolir, dan pemulihan pada lab sebelum produksi.

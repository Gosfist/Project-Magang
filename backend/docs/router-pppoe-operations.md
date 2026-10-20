# Router dan PPPoE tanpa API MikroTik

## Router dan script

Kolom Status VPN pada daftar NAS berasal dari sesi SSTP server: username dan IP harus cocok pada sesi active. Daftar sesi kosong berarti Offline, bukan berdasarkan isActive NAS. Worker membaca Accel-PPP setiap 10 detik; web memuat ulang daftar setiap 15 detik. Pembacaan gagal atau snapshot lebih dari 45 detik tampil Tidak diketahui, akun eksternal juga Tidak diketahui, dan NAS lokal tampil Tanpa VPN. Web hanya membaca snapshot lokal tanpa akses sudo/CLI atau API MikroTik. Status VPN bukan bukti dial PPPoE pelanggan.

Buat akun melalui Router > Klien VPN. Server SSTP berjalan pada VPS website/FreeRADIUS yang sama, TCP 4443. Akun mendapat IP unik 10.88.0.2-254, server RADIUS 10.88.0.1. Worker root menerapkan akun sekitar 15 detik. Siap berarti akun diterapkan, belum berarti tunnel online. Password tersimpan terenkripsi dan dapat ditampilkan administrator; endpoint kredensial tidak di-cache.

Pada tambah/edit NAS pilih klien VPN yang Siap dan belum dipakai router lain. IP sumber RADIUS, tujuan Disconnect, host, dan username berasal dari akun. Password otomatis dimasukkan dalam script tanpa disalin ke tabel NAS. Tidak ada impor CA pada script sederhana. Satu klien untuk satu router juga ditegakkan database. Kredensial API/admin MikroTik tidak digunakan.

Simpan membuka satu script SSTP port 4443, RADIUS/Disconnect, PPP AAA/accounting, kedua pool/profil PPP dan firewall isolir. Tambah, Edit dan membuka ulang selalu menghasilkan add untuk entri daftar. Tidak ada pilihan mode, centang pemasangan, tombol konfirmasi, blok if atau pencarian konfigurasi lama. PPP AAA dan RADIUS incoming adalah pengaturan tunggal sehingga tetap memakai set. Verifikasi sertifikat server dimatikan pada mode sederhana. Script unduhan tidak dieksekusi aplikasi. Uji tunnel dan PPPoE nyata tetap diperlukan; NAS lokal tetap didukung.

Komentar script NAS dikelompokkan menurut fungsi: UNZANET-RADIUS:VPN untuk VPN/RADIUS, UNZANET-RADIUS:INTERNET untuk pool internet, dan UNZANET-RADIUS:ISOLIR untuk pool serta seluruh firewall isolir. Tidak ada akhiran ID, IN atau OUT pada komentar. Nama pool/profil tetap sama.

Worker root terpisah menerapkan perubahan client SQL sekitar setiap 60 detik setelah config check. Web tidak diberi sudo. Lihat [panduan instalasi](instalasi-ubuntu-vpn.md).

## IP Pool

Submenu IP Pool dan Isolir PPPoE dipindahkan ke Tambah/Edit Router NAS; URL lama mengarah ke Router / NAS. Isi IP Pool Internet dan IP Pool Isolir dengan gateway/prefix, misalnya 192.168.75.1/24 dan 192.168.100.1/24. Rentang otomatis mengecualikan network, broadcast, dan gateway. Subnet tidak boleh tumpang tindih atau mencakup IP NAS/RADIUS. Pool bernama Internet dan pool-isolir pada setiap NAS, profilnya UNZANET-INTERNET-ID dan UNZANET-ISOLIR-ID.

Klik Salin Script lalu paste ke Terminal Winbox. Script membuat pool sebelum profil dan SSTP sebelum route. Tidak ada deteksi atau penghapusan duplikat otomatis; perintah add tetap ditampilkan walau konfigurasi pernah dibuat. RouterOS dapat menolak nama pool/profil/interface yang sudah ada, sedangkan entri yang dapat digandakan akan ditambahkan kembali. Pastikan rule drop isolir berada sebelum accept/FastTrack.

set [find ...] pada script lama tidak membuat entri yang belum ada; buka ulang script terbaru yang memakai add. Error remote-address pada profil dapat terjadi karena pool belum dibuat; selesaikan pembuatan pool dahulu. Error route perlu diperiksa bersama keberadaan interface SSTP. Rujukan: [perintah add dan set RouterOS](https://help.mikrotik.com/docs/spaces/ROS/pages/328134/Command+Line+Interface).

Simpan/Edit langsung menulis prefix NAS dan konfigurasi isolir pada AppSetting, lalu menjadwalkan sinkronisasi RADIUS/sesi saat konfigurasi berubah. Menyimpan prefix yang sama tidak menjadwalkan reconnect baru. Proses sinkronisasi lama tidak boleh menimpa konfigurasi yang lebih baru. Harga Paket mengatur harga/kecepatan/masa aktif; RADIUS memakai pool/profil NAS pelanggan. NAS lama tanpa prefix tersimpan tetap memakai referensi pool paket lama. Penggunaan/sisa IP router tidak dipantau; tidak ada /ip/pool/used atau polling SNMP.

## Perubahan pelanggan dan pemutusan sesi

Perubahan akun, paket, status dan atribut RADIUS diselesaikan dalam transaksi sebelum Disconnect Request dikirim. Sasaran menggunakan NAS terdaftar dan identitas username/sesi accounting. Respons diperiksa autentikatornya dan ditangani sebagai ACK, NAK, atau timeout. Kegagalan perangkat tidak membatalkan status yang sudah tersimpan.

Putus Sesi dapat dicoba ulang. Akun aktif bisa menyambung kembali setelah disconnect manual. Backend tidak mengarang Accounting Stop; NAS tetap menjadi sumber Start/Stop/Interim. Signed ACK/NAK 503 memiliki penanda per sesi agar accounting yang terlambat tidak menahan reconnect. Isolir/pemulihan pool memerlukan reconnect untuk menerima IP baru.

Status online adalah hasil accounting yang masih segar. Default RADIUS_ACCOUNTING_STALE_SECONDS 900 detik cocok dengan update 5 menit. RADIUS_ACCOUNTING_TIMEZONE harus sesuai DATETIME yang ditulis SQL; installer baru menetapkan sesi SQL dan pembacaan backend ke UTC, sementara tampilan memakai WIB. Pasang Baru dan Data Pelanggan memakai pembaca accounting yang sama. Nilai null ditampilkan Belum diketahui, bukan Offline; Aktif adalah status layanan dan tidak membuktikan sesi Online. Lihat diagnosis UTC/WIB pada bagian 9.7 panduan instalasi.

Jam OS server dan zona MikroTik memakai Asia/Jakarta. Installer mengaktifkan NTP
server dan mempertahankan SQL accounting UTC; log authdate mengikuti proses
FreeRADIUS Jakarta dan dibaca WIB. Periksa sinkronisasi aktual NTP server/router,
bukan hanya zona waktu. Script NAS mengatur clock pada bagian 3; lihat bagian 9.9.
Untuk limit Mbps, periksa counter queue pelanggan. Kasus wisnu 20M/20M terselesaikan
setelah profil internet diberi parent-queue=CLIENT dan sesi login ulang; queue
sebelumnya parent=none dengan counter nol di belakang CLIENT yang menangkap subnet.
Nama parent harus mengikuti router setempat; lihat bagian 9.8 dan pppoe-bandwidth.md.

Aktivasi kembali lewat Edit Pelanggan (isActive false menjadi true) meminta
Disconnect setelah commit agar sesi memuat ulang profil Internet dan limit paket.
Jalur lama belum meminta Disconnect langsung untuk perubahan ini. Data SQL dan
profil yang sudah benar tidak membuktikan queue sesi telah mengikuti: pada uji
lanjutan wisnu, queue masih parent=none/counter nol hingga login ulang, lalu
parent=CLIENT dan download 19.9 Mbps. Periksa juga default-profile PPPoE Server
setelah profil lama dihapus; arahkan ke profil Internet yang masih ada.

## Form pelanggan dan tagihan

Tabel Tagihan Kolektor dan detail pelanggan Data Area menampilkan nama pelanggan
diikuti ID pelanggan enam digit (customerNumber), misalnya 000001, pada baris
kedua. ID ini berbeda dari username PPPoE; username tetap dipakai untuk login dan
identitas sesi RADIUS.

Form pelanggan/foto KTP, pemilihan ODP, kepemilikan role, serta workflow pembayaran tidak berubah karena transport router diganti. Edit pelanggan tidak membuat invoice pertama baru. Mode tagihan none tidak membuat invoice; full memakai harga penuh; prorate berlaku untuk POSTPAID sedangkan PREPAID tetap penuh.

## Instalasi baru dan validasi

Instalasi baru memakai database.sql pada database kosong pada VPS baru. Skema ini sudah tidak memiliki kolom kredensial API NAS atau tabel statistik router. Tidak ada migrasi terpisah. Jika layanan lain tidak menggunakan API, nonaktifkan layanan api/api ssl pada perangkat secara manual setelah memeriksa integrasi lain.

Tes script, database tiruan, dan UDP lokal tidak membuktikan NAS nyata. Uji dial pelanggan, accounting, Disconnect, isolir, dan pemulihan pada lab sebelum produksi.

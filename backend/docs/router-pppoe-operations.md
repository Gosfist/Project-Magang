# Router dan PPPoE tanpa API MikroTik

## Router dan script

Kolom Status VPN pada daftar NAS berasal dari sesi SSTP server: username dan IP harus cocok pada sesi active. Daftar sesi kosong berarti Offline, bukan berdasarkan isActive NAS. Worker membaca Accel-PPP setiap 10 detik; web memuat ulang daftar setiap 15 detik. Pembacaan gagal atau snapshot lebih dari 45 detik tampil Tidak diketahui, akun eksternal juga Tidak diketahui, dan NAS lokal tampil Tanpa VPN. Web hanya membaca snapshot lokal tanpa akses sudo/CLI atau API MikroTik. Status VPN bukan bukti dial PPPoE pelanggan.

Buat akun melalui Router > Klien VPN. Server SSTP berjalan pada VPS website/FreeRADIUS yang sama, TCP 4443. Akun mendapat IP unik 10.88.0.2-254, server RADIUS 10.88.0.1. Worker root menerapkan akun sekitar 15 detik. Siap berarti akun diterapkan, belum berarti tunnel online. Password tersimpan terenkripsi dan dapat ditampilkan administrator; endpoint kredensial tidak di-cache.

Pada tambah/edit NAS pilih klien VPN yang Siap dan belum dipakai router lain. IP sumber RADIUS, tujuan Disconnect, host, dan username berasal dari akun. Password otomatis dimasukkan dalam script tanpa disalin ke tabel NAS. Tidak ada impor CA pada script sederhana. Satu klien untuk satu router juga ditegakkan database. Kredensial API/admin MikroTik tidak digunakan.

Simpan membuka script tiga bagian untuk dipasang melalui Terminal perangkat: SSTP port 4443, RADIUS/Disconnect beserta rute /32 dan firewall, lalu PPP AAA/accounting. Verifikasi sertifikat server dimatikan pada mode sederhana. TLS tetap dipakai, tetapi identitas server tidak diverifikasi sehingga ada risiko server palsu. Tombol Script menghasilkan perintah add langsung dari akun tersimpan, tanpa :if atau pemeriksaan duplikat. Script hanya untuk pemasangan awal. Untuk mengganti username/password akun yang sudah terpasang, edit User/Password interface SSTP melalui Winbox. Paste ulang dapat membuat entri ganda atau bentrok nama tunnel. Uji tunnel dan PPPoE nyata tetap diperlukan. NAS lokal tanpa VPN masih dapat diisi manual.

Worker root terpisah menerapkan perubahan client SQL sekitar setiap 60 detik setelah config check. Web tidak diberi sudo. Lihat [panduan instalasi](instalasi-ubuntu-vpn.md).

## IP Pool

Daftar pool merupakan metadata per NAS. Tambah/edit/hapus menghasilkan script untuk dipasang operator, bukan perintah ke perangkat. Pool yang dipakai paket/isolir tetap dilindungi. Pool lama tanpa relasi NAS perlu dipetakan. Pool perangkat yang tidak didaftarkan tidak muncul otomatis.

Harga Paket menyimpan nama pool untuk Framed Pool; nama/rentang harus benar benar tersedia pada router tujuan. Penggunaan dan sisa IP pool tidak dipantau serta ditampilkan tidak diketahui. Tidak ada pembacaan /ip/pool/used atau polling SNMP.

## Perubahan pelanggan dan pemutusan sesi

Perubahan akun, paket, status dan atribut RADIUS diselesaikan dalam transaksi sebelum Disconnect Request dikirim. Sasaran menggunakan NAS terdaftar dan identitas username/sesi accounting. Respons diperiksa autentikatornya dan ditangani sebagai ACK, NAK, atau timeout. Kegagalan perangkat tidak membatalkan status yang sudah tersimpan.

Putus Sesi dapat dicoba ulang. Akun aktif bisa menyambung kembali setelah disconnect manual. Backend tidak mengarang Accounting Stop; NAS tetap menjadi sumber Start/Stop/Interim. Signed ACK/NAK 503 memiliki penanda per sesi agar accounting yang terlambat tidak menahan reconnect. Isolir/pemulihan pool memerlukan reconnect untuk menerima IP baru.

Status online adalah hasil accounting yang masih segar. Default RADIUS_ACCOUNTING_STALE_SECONDS 900 detik cocok dengan update 5 menit. RADIUS_ACCOUNTING_TIMEZONE harus sesuai DATETIME yang ditulis SQL; installer baru menggunakan WIB. Data stale ditampilkan sebagai tidak pasti.

## Form pelanggan dan tagihan

Form pelanggan/foto KTP, pemilihan ODP, kepemilikan role, serta workflow pembayaran tidak berubah karena transport router diganti. Edit pelanggan tidak membuat invoice pertama baru. Mode tagihan none tidak membuat invoice; full memakai harga penuh; prorate berlaku untuk POSTPAID sedangkan PREPAID tetap penuh.

## Instalasi baru dan validasi

Instalasi baru memakai database.sql pada database kosong pada VPS baru. Skema ini sudah tidak memiliki kolom kredensial API NAS atau tabel statistik router. Tidak ada migrasi terpisah. Jika layanan lain tidak menggunakan API, nonaktifkan layanan api/api ssl pada perangkat secara manual setelah memeriksa integrasi lain.

Tes script, database tiruan, dan UDP lokal tidak membuktikan NAS nyata. Uji dial pelanggan, accounting, Disconnect, isolir, dan pemulihan pada lab sebelum produksi.

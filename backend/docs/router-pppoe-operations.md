# Router dan PPPoE tanpa API MikroTik

## Router dan script

Tambah atau edit NAS menyimpan IP sumber RADIUS, alamat tujuan Disconnect, port autentikasi/Disconnect, IP server, shared secret, serta metadata VPN opsional. Tidak ada username/password admin, port API, atau login API MikroTik. Password VPN router hanya dipakai untuk menghasilkan script saat Simpan dan tidak disimpan.

Simpan membuka script pemasangan otomatis. Untuk router baru, isi akun VPN router dan satu CA publik PEM pada form, lalu salin script sekali ke Terminal perangkat. Script mengimpor CA, mengatur SSTP terverifikasi, rute server RADIUS, RADIUS, incoming Disconnect 3799, serta firewall terkait. CA dari form tidak disimpan dalam tabel NAS dan tidak boleh berisi private key. Rute dua arah melalui gateway harus tersedia. Endpoint lama tes login API dan monitoring router dihapus. Status accounting/RADIUS membuktikan komunikasi sesuai data yang masuk, bukan CPU atau jangkauan seluruh router.

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

Instalasi baru memakai database.sql pada database kosong di VM baru. Skema ini sudah tidak memiliki kolom kredensial API NAS atau tabel statistik router. Tidak ada migrasi terpisah. Jika layanan lain tidak menggunakan API, nonaktifkan layanan api/api ssl pada perangkat secara manual setelah memeriksa integrasi lain.

Tes script, database tiruan, dan UDP lokal tidak membuktikan NAS nyata. Uji dial pelanggan, accounting, Disconnect, isolir, dan pemulihan pada lab sebelum produksi.

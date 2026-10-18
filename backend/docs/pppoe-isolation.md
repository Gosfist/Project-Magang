# Isolir PPPoE dengan RADIUS Disconnect dan script perangkat

Mode pool isolir diaktifkan per NAS. Pelanggan isolir tetap menerima Access Accept dengan kredensial yang benar, lalu memperoleh pool/profil khusus; firewall pada router memblokir trafik subnet isolir. Tidak ada login API, pembacaan konfigurasi router, atau pembuatan rule otomatis melalui jaringan.

## Pemasangan

1. Pastikan RADIUS 1812/1813 dan jalur server ke NAS pada UDP 3799 berfungsi. Daftarkan pool isolir terpisah pada IP Pool untuk NAS tersebut.
2. Buka Isolir PPPoE, pilih router, pool, subnet, dan gateway PPP. Contoh rentang 192.168.100.2 sampai 192.168.100.254, subnet 192.168.100.0/24, gateway 192.168.100.1. Jangan gunakan sebagai pool Harga Paket.
3. Buat script pemasangan dari web. Rencana ini belum mengaktifkan atribut RADIUS. Salin seluruh script ke Terminal NAS yang benar.
4. Periksa pool, profil UNZANET ISOLIR, dan tiga rule drop sebelum accept/FastTrack pada router. Setelah benar, konfirmasikan pemasangan script di web untuk mengaktifkan mode dan sinkronisasi.
5. Uji dial pelanggan isolir, IP subnet isolir, blok internet dan akses router. Uji ACC/janji bayar mengembalikan pool normal melalui reconnect.

Konfirmasi operator tidak berarti backend memeriksa isi router. UI tidak boleh menyatakan perangkat telah diverifikasi otomatis. Subnet/pool harus cukup kapasitas dan tidak tumpang tindih; gateway bukan alamat yang dibagikan ke pelanggan. Untuk IPv6, profil isolir menonaktifkannya sesuai script.

## Sinkronisasi

Konfigurasi per NAS disimpan pada AppSetting. Atribut RADIUS mempertahankan password dan Simultaneous Use; pool/profil isolir dikirim melalui Framed Pool dan Mikrotik Group. Mode pool tidak menggunakan Expiration untuk menolak login saat masa aktif habis. Password yang salah tetap ditolak.

Sinkronisasi menyelesaikan transaksi RADIUS lalu mengirim Disconnect Request kepada sesi accounting yang perlu berpindah IP. Backend memeriksa balasan yang sah, ACK/NAK/timeout, dan tidak menulis Accounting Stop palsu. Sesi baru memperoleh atribut yang sesuai. ACC pembayaran dan janji bayar memakai jalur yang sama setelah commit. Pemeriksaan masa aktif/pending berjalan berkala tiap menit; tidak ada jaminan seluruh proses kurang dari satu detik.

Status dan IP sesi berasal dari accounting dengan batas kesegaran, bukan daftar PPP aktif langsung. Data stale bukan bukti pasti offline/online. Kegagalan jalur NAS ditampilkan dan dapat dicoba ulang melalui Sinkron Ulang/Putus Sesi.

## Menonaktifkan atau mengganti konfigurasi

Nonaktifkan mode dan tunggu sinkronisasi sebelum mengganti pool/subnet. Tidak ada penghapusan firewall/profil perangkat otomatis. Rule drop lama dipertahankan agar sesi isolir yang belum terputus tetap dibatasi. Periksa sesi melalui Terminal, pastikan tidak ada pelanggan pada subnet lama, lalu bersihkan artefak lama secara manual. Jangan membuka akses subnet isolir hanya karena perubahan web berhasil disimpan.

Tes lokal memeriksa script, transaksi, dan protokol UDP; belum membuktikan IP/firewall/dial PPPoE pada perangkat. Lihat [panduan instalasi dan uji](instalasi-ubuntu-vpn.md) dan [RADIUS MikroTik](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS).

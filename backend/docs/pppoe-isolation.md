# Isolir PPPoE dengan RADIUS Disconnect dan script perangkat

Mode pool isolir diaktifkan per NAS. Pelanggan isolir tetap menerima Access Accept dengan kredensial yang benar, lalu memperoleh pool/profil khusus; firewall pada router memblokir trafik subnet isolir. Tidak ada login API, pembacaan konfigurasi router, atau pembuatan rule otomatis melalui jaringan.

## Pemasangan

1. Pastikan RADIUS 1812/1813 dan jalur server ke NAS pada UDP 3799 berfungsi.
2. Buka Router > Router / NAS > Tambah/Edit. Isi IP Pool Internet, misalnya 192.168.75.1/24, dan IP Pool Isolir, misalnya 192.168.100.1/24. IP sebelum prefix menjadi gateway; rentang setelahnya sampai host terakhir dipakai pelanggan. Gateway host terakhir memakai rentang sebelum gateway. Network, broadcast, dan gateway tidak masuk pool.
3. Simpan & Buat Script, klik Salin Script lalu paste ke Terminal NAS yang benar. Script selalu memakai add untuk pool/profil/firewall, termasuk setelah Edit atau membuka ulang. Tidak ada pertanyaan sudah terpasang atau centang konfirmasi. Pool bernama Internet/pool-isolir, profil UNZANET-INTERNET-ID/UNZANET-ISOLIR-ID. Simpan NAS langsung memperbarui pengaturan yang dipakai RADIUS. Submenu IP Pool/Isolir lama diarahkan ke Router / NAS.
4. Periksa pool/profil dan tiga rule drop. Posisikan drop isolir sebelum accept/FastTrack melalui Winbox. Sinkronisasi RADIUS/sesi berjalan berkala tanpa langkah konfirmasi tambahan.
5. Uji dial pelanggan isolir, IP subnet isolir, blok internet dan akses router. Uji ACC/janji bayar mengembalikan pool normal melalui reconnect.

Pool internet memakai komentar UNZANET-RADIUS:INTERNET. Pool dan ketiga firewall isolir memakai UNZANET-RADIUS:ISOLIR, tanpa akhiran ID/IN/OUT. Tidak ada pencarian atau perubahan rule lama pada script.

Backend tidak memeriksa isi router. Subnet/pool harus cukup kapasitas dan tidak tumpang tindih; gateway bukan alamat yang dibagikan ke pelanggan. Untuk IPv6, profil isolir menonaktifkannya sesuai script.

## Sinkronisasi

Prefix dan konfigurasi isolir langsung disimpan atomik bersama NAS pada AppSetting tanpa perubahan skema SQL. RADIUS memilih pool Internet dan profil internet milik NAS untuk akun normal, pool/profil isolir untuk akun isolir. Harga Paket mengatur harga/kecepatan/masa aktif; pilihan pool lama tetap menjadi fallback pada NAS yang belum memakai prefix baru. Password dan Simultaneous Use dipertahankan. Mode pool tidak memakai Expiration untuk menolak login saat masa aktif habis; password salah tetap ditolak.

Sinkronisasi menyelesaikan transaksi RADIUS lalu mengirim Disconnect Request kepada sesi accounting yang perlu berpindah IP. Backend memeriksa balasan yang sah, ACK/NAK/timeout, dan tidak menulis Accounting Stop palsu. Sesi baru memperoleh atribut yang sesuai. ACC pembayaran dan janji bayar memakai jalur yang sama setelah commit. Pemeriksaan masa aktif/pending berjalan berkala tiap menit; tidak ada jaminan seluruh proses kurang dari satu detik.

Status dan IP sesi berasal dari accounting dengan batas kesegaran, bukan daftar PPP aktif langsung. Data stale bukan bukti pasti offline/online. Kegagalan jalur NAS ditampilkan dan dapat dicoba ulang melalui Sinkron Ulang/Putus Sesi.

## Menonaktifkan atau mengganti konfigurasi

Ubah prefix melalui Edit Router NAS lalu simpan. Pool RADIUS langsung memakai pengaturan terbaru dan sesi dijadwalkan reconnect bila prefix berubah. Script tetap memakai add, tanpa memeriksa pemasangan sebelumnya. Tidak ada penghapusan otomatis konfigurasi lain pada perangkat. Periksa dan bersihkan artefak lama melalui Winbox setelah tidak dipakai.

Tes lokal memeriksa script, transaksi, dan protokol UDP; belum membuktikan IP/firewall/dial PPPoE pada perangkat. Lihat [panduan instalasi dan uji](instalasi-ubuntu-vpn.md) dan [RADIUS MikroTik](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS).

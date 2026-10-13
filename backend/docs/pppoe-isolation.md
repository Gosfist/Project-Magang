# Isolir PPPoE dengan pool khusus dan firewall otomatis

Mode ini diaktifkan per Router/NAS. Akun isolir tetap menerima Access-Accept dengan
kredensial PPPoE yang benar, tetapi memakai pool khusus dan profil PPP isolir.
Firewall memblokir trafik berdasarkan subnet tersebut. Akun normal tetap memakai
pool internet Harga Paket. Mode bawaan tetap perilaku lama sampai administrator
menekan **Terapkan ke MikroTik**.

## Pengaturan melalui web

1. Pastikan Router/NAS aktif dan koneksi API MikroTik berhasil. Akun API harus
   mempunyai izin membaca/mengubah pool, profil PPP, firewall, dan sesi PPP aktif.
   Pelanggan harus menggunakan autentikasi RADIUS yang terhubung ke database aplikasi.
2. Buka **PPPoE > IP Pool**, pilih router, lalu buat pool terpisah, misalnya
   `pool-isolir` dengan rentang `192.168.100.2-192.168.100.254`. Jangan gunakan pool
   tersebut pada Harga Paket. Pool internet contoh tetap `192.168.75.2-192.168.75.254`.
3. Buka **PPPoE > Isolir PPPoE**, pilih router yang sama, aktifkan mode, pilih
   `pool-isolir`, isi subnet `192.168.100.0/24` dan gateway PPP `192.168.100.1`.
   Tekan **Terapkan ke MikroTik**, lalu tunggu sinkronisasi selesai.
4. Periksa tiga rule drop dan status konfigurasi. Uji pelanggan isolir memakai
   IP subnet isolir, tetap terhubung PPPoE, dan tidak dapat mengakses internet
   maupun layanan router. Uji ACC Finance/janji bayar mengembalikan IP pool internet.

Rentang contoh berisi 253 IP. Untuk ribuan sesi isolir bersamaan, sediakan subnet
dan rentang yang cukup besar serta kapasitas router yang memadai. Pool tidak boleh
tumpang tindih dengan pool lain/jaringan interface, menyertakan network/broadcast/
gateway, atau memakai next-pool. Gateway disediakan oleh profil PPP; jangan
menambahkan subnet isolir sebagai jaringan interface sebelum menerapkan konfigurasi.

## Perilaku sistem

- Konfigurasi tersimpan pada AppSetting `pppoe_isolation_router_{id}`; tidak perlu
  migrasi skema. Pool tetap dibaca langsung dari RouterOS.
- Profil `UNZANET-ISOLIR-{id}` memakai local-address gateway, remote-address pool,
  `use-ipv6=no`, dan tanpa session/idle timeout. Tiga rule IPv4 filter dengan
  komentar `UNZANET-ISOLIR:{id}:...` ditempatkan sebelum accept/FastTrack: forward
  dari subnet, forward menuju subnet, dan input dari subnet.
- RADIUS mempertahankan Cleartext-Password dan Simultaneous-Use. Pelanggan isolir
  menerima Framed-Pool isolir dan Mikrotik-Group profil isolir. Expiration tidak
  dipakai selama mode aktif, supaya masa aktif habis memindahkan pool alih-alih
  menolak autentikasi. Password salah tetap ditolak.
- Sinkronisasi berjalan per batch 100 akun, membaca ulang akun dalam transaksi
  sebelum mengubah RADIUS. Pemeriksaan berkala setiap menit menangani masa aktif
  habis dan mencoba kembali sinkronisasi yang tertunda. Baris RADIUS yang sudah
  sesuai dilewati. API MikroTik tidak dipanggil pada setiap autentikasi RADIUS.
- Sinkronisasi membaca daftar sesi sekali dan memutus hanya sesi pelanggan dengan
  IP yang tidak sesuai statusnya. Router pelanggan menyambung ulang untuk mendapat
  IP baru; sesi yang sudah benar dipertahankan. ACC dan janji bayar memperbarui
  RADIUS dalam transaksi, lalu meminta reconnect setelah commit.
- Jika sinkronisasi gagal, status menampilkan kegagalan. Gunakan **Sinkron Ulang**
  setelah koneksi pulih; tugas tertunda juga dicoba berkala setelah backend restart.
  Config yang sedang tersinkron tidak dapat diganti ke subnet/pool lain.
- Untuk mengganti pool/subnet, nonaktifkan mode dan tunggu sinkronisasi selesai
  terlebih dahulu. Menonaktifkan mode mengembalikan isolir ke penolakan login,
  memutus sesi terkait, kemudian menghapus rule drop yang dikelola aplikasi.
- Profil/rule isolir tetap harus dijaga jika ada perubahan manual di MikroTik.
  Status siap memeriksa pool, profil, dan posisi rule; sinkronisasi akun bukan
  pengganti penerapan ulang konfigurasi router yang diubah dari luar aplikasi.

## Firewall otomatis

Rule drop dibuat dan ditata otomatis melalui **PPPoE > Isolir PPPoE** ketika
menekan **Terapkan ke MikroTik**. Administrator tidak perlu membuat rule isolir
secara manual. Daftar rule terkelola tetap ditampilkan pada halaman Isolir PPPoE.
Menu, halaman, dan API pengelolaan firewall umum telah dihapus. Penghapusan fitur
editor ini tidak menghapus rule yang sudah terpasang di router.

## Batas validasi

Tes otomatis memakai database/API RouterOS tiruan. Build dan tes lokal tidak
membuktikan dial PPPoE, distribusi IP, firewall, maupun kemampuan ribuan sesi pada
perangkat nyata. Verifikasi langkah 4 pada router uji setelah deployment.

Referensi resmi:

- [RADIUS dan atribut Framed-Pool/Mikrotik-Group](https://manual.mikrotik.com/docs/authentication-authorization-accounting/radius/)
- [Profil dan autentikasi PPP](https://manual.mikrotik.com/docs/authentication-authorization-accounting/ppp-aaa/)
- [Alur paket dan FastTrack](https://manual.mikrotik.com/docs/firewall-and-quality-of-service/packet-flow-in-routeros/)

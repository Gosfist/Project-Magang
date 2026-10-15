# ZeroTier untuk Ubuntu RADIUS dan MikroTik cabang

Panduan stack aktif Angular/NestJS/Prisma dan FreeRADIUS. Server VPN WireGuard tidak lagi dikelola aplikasi. Ubuntu tetap menjalankan RADIUS, sekaligus menjadi satu anggota ZeroTier. ZeroTier Central mengatur jaringan virtual dan otorisasi anggota.

```text
Ubuntu VM: web + API + FreeRADIUS (1 anggota ZeroTier)
                 |
         Jaringan ZeroTier Private
                 |
        MikroTik pusat + cabang (hingga 9 perangkat lain)
```

IP publik tetap tidak diperlukan pada Ubuntu untuk membentuk overlay; keberhasilan koneksi bergantung pada internet/NAT/firewall di kedua sisi. Jaringan ini membawa akses manajemen, RADIUS, accounting dan pemutusan sesi. Internet pelanggan PPPoE tetap keluar melalui WAN router masing-masing; tidak perlu meneruskan seluruh trafik pelanggan atau bridge LAN melalui ZeroTier.

## Batas perangkat dan otomatisasi

- Batas aplikasi: 10 perangkat, satu jaringan. Satu slot Ubuntu dicadangkan meskipun catatannya belum dibuat. Satu Ubuntu + sembilan MikroTik = 10. Jika laptop/HP ikut, perangkat itu mengambil slot juga; sembilan slot tersebut tidak khusus router.
- Semua catatan ZeroTier, termasuk yang nonaktif atau belum selesai setup, dihitung. Pelanggan PPPoE biasa bukan anggota ZeroTier dan tidak dihitung.
- Penghitung web membaca database aplikasi, bukan daftar anggota Central. Daftarkan setiap anggota di web dan cocokkan dengan Central. Menghapus/nonaktifkan catatan tidak mencabut otorisasi atau mengeluarkan node dari jaringan.
- Paket Personal yang tercantum pada harga resmi saat panduan dibuat menyediakan 10 perangkat/1 network untuk personal/nonkomersial, tanpa API Central. Untuk penggunaan komersial dan API, periksa paket yang mendukungnya. Dokumentasi lama dapat menyebut batas berbeda.
- Menambah catatan di web tidak dapat menghubungi router yang belum tersambung. Setup awal (instalasi/join) sekali pada perangkat dan authorize di Central tetap diperlukan. Aplikasi tidak menyimpan token Central dan tidak menjalankan instalasi, join, firewall, restart atau perubahan router saat tombol Simpan ditekan.

## 1. Jaringan Central

1. Buat satu jaringan **Private** di https://central.zerotier.com/.
2. Catat Network ID 16 karakter heksadesimal.
3. Pilih subnet Managed IP yang berbeda dari LAN/pool PPPoE semua cabang. Contoh ilustrasi: `10.88.0.0/24`; pastikan subnet ini belum dipakai.
4. Berikan Managed IP tetap pada anggota setelah join, misalnya Ubuntu `10.88.0.1`, MikroTik pusat `10.88.0.2`, cabang A `10.88.0.3`. IP contoh bukan IP otomatis aplikasi.

## 2. Ubuntu di VirtualBox

Pasang ZeroTier **di dalam Ubuntu guest**. Instalasi di Windows host saja tidak menjadikan Ubuntu anggota ZeroTier.

Untuk mempertahankan akses web LAN yang sudah berjalan, gunakan Bridged Adapter ke adaptor fisik yang benar dan pastikan Ubuntu mempunyai IP, gateway, DNS serta internet. Host-Only saja tidak memberikan internet. NAT juga dapat memberi guest akses keluar untuk ZeroTier, tetapi akses langsung web dari LAN memerlukan konfigurasi tambahan; jangan mengganti jaringan VM yang sudah bekerja hanya untuk memasang ZeroTier.

Periksa koneksi Ubuntu:

```bash
ip -br address
ip route
getent hosts install.zerotier.com
```

Unduh installer resmi dan jalankan di Ubuntu:

```bash
curl -fsSL https://install.zerotier.com -o /tmp/zerotier-install.sh
sudo bash /tmp/zerotier-install.sh
sudo systemctl enable --now zerotier-one
```

Di web buka Router > Klien VPN > Tambah. Isi nama Ubuntu RADIUS, jenis Ubuntu/Linux, Network ID, dan centang Server RADIUS. Node ID/IP boleh kosong saat awal. Setelah disimpan, buka **Script Setup**, lalu jalankan perintah join di Ubuntu. Contoh, ganti Network ID dengan milik Anda:

```bash
sudo zerotier-cli join NETWORK_ID_ANDA
sudo zerotier-cli info
sudo zerotier-cli listnetworks
```

Authorize anggota Ubuntu di Central. Catat Node ID 10 karakter dari `info`, Managed IP dan nama interface `zt...` dari `listnetworks`. Edit catatan Ubuntu di web dengan Node ID/IP tersebut. Jangan memasukkan identity secret atau token lokal ZeroTier ke web.

PC host dan VM harus tetap menyala, Ubuntu tidak boleh sleep, dan service `zerotier-one` serta `freeradius` harus berjalan agar cabang dapat memakai RADIUS. Jika VM diklon, jangan menjalankan dua salinan dengan identitas ZeroTier yang sama.

## 3. MikroTik RouterOS 7 ARM/ARM64

1. Periksa `/system resource print` dan `/system package print` untuk versi/arsitektur. Instal paket tambahan **zerotier** dengan versi yang sama persis dengan RouterOS; reboot saat diperlukan. Periksa apakah device-mode mengizinkan ZeroTier. Aktivasi device-mode dapat memerlukan konfirmasi fisik menurut perangkat/versinya.
2. Tambah klien MikroTik pada web dengan Network ID yang sama. Buka Script Setup dan tempel di Terminal/WinBox lokal sekali. Jangan menempel script Linux ke MikroTik.
3. Script menggunakan instance `zt1`, meminta managed address, menolak default route/global route, dan memakai interface yang sudah join network bila ada. Script tidak membuat NAT atau forward trafik pelanggan.
4. Authorize anggota di Central dan berikan Managed IP tetap. Isi Node ID dan IP ke catatan web. Node ID terlihat di anggota Central; IP perangkat dapat dilihat melalui `/ip address print`.
5. Pastikan IP Ubuntu telah disimpan di web, lalu ambil ulang script MikroTik. Script menambahkan/memperbarui rule input khusus interface ZeroTier, bersumber dari IP Ubuntu saja: port API (default TCP 8728), CoA UDP 3799, dan ICMP. Rule terkelola ditempatkan sebelum rule lain; script dapat dijalankan ulang tanpa membuat rule baru dengan marker yang sama.
6. Jika `/ip service` untuk API memiliki whitelist, tambahkan IP ZeroTier Ubuntu `/32` ke whitelist yang ada. Script tidak menimpa whitelist, membuat akun API, atau membuka WinBox ke semua anggota jaringan.
7. Jaga konektivitas UDP keluar untuk ZeroTier. UDP 9993 penting, tetapi peer juga dapat memakai port UDP lain; mengizinkan hanya satu port dapat membuat jalur peer gagal/beralih relay.

## 4. Hubungkan Router / NAS dan FreeRADIUS

Di Router / NAS, pilih klien ZeroTier MikroTik yang Node ID dan IP-nya sudah dicatat. IP API dan `nasname` otomatis menggunakan IP tersebut. Isi akun API yang sudah ada pada MikroTik dan secret RADIUS yang kuat. Ubuntu RADIUS tidak ditawarkan sebagai klien router.

Unduh **Script RADIUS** dari Router / NAS. Targetnya IP ZeroTier anggota Ubuntu dalam network yang sama, dan `src-address` adalah IP ZeroTier MikroTik. Jika anggota Ubuntu belum lengkap, aplikasi menolak membuat script daripada memilih IP LAN secara otomatis.

Script mengelola satu entri RADIUS dan rule CoA bertanda ID NAS, dapat diulang, serta tidak menghapus semua konfigurasi RADIUS lain. Periksa entri LAN/WireGuard lama; nonaktifkan entri lama yang bertabrakan setelah koneksi baru teruji. Script tidak memutus sesi pelanggan yang sedang aktif.

Di Ubuntu, periksa listener:

```bash
sudo ss -lunp
sudo freeradius -XC
```

FreeRADIUS harus menerima UDP auth/accounting pada IP ZeroTier atau listener IPv4 yang mencakupnya, bukan hanya loopback/IP LAN. Untuk FreeRADIUS 3.x yang membaca NAS dari SQL, periksa `/etc/freeradius/3.0/mods-enabled/sql`: koneksi mengarah ke database aplikasi yang sama, `read_clients = yes`, dan `client_table = "nas"`. Site auth/accounting harus memanggil modul SQL yang sudah digunakan aplikasi. Jangan mengganti seluruh konfigurasi server yang sudah bekerja.

Jika SQL clients dibaca hanya saat startup, perubahan tabel `nas` memerlukan restart FreeRADIUS; jangan menganggap simpan di web otomatis memperbarui client dalam memori. Setelah validasi konfigurasi sukses, pada waktu yang sesuai jalankan:

```bash
sudo systemctl restart freeradius
sudo systemctl status freeradius --no-pager
```

Jika UFW aktif, izinkan hanya IP MikroTik pada interface ZeroTier. Contoh berikut memakai IP ilustrasi; **ganti `ztXXXXXXXX` dengan nama interface asli** dan ulangi untuk cabang lain:

```bash
sudo ufw status verbose
sudo ufw allow in on ztXXXXXXXX from 10.88.0.2 to any port 1812 proto udp
sudo ufw allow in on ztXXXXXXXX from 10.88.0.2 to any port 1813 proto udp
```

Jangan mengaktifkan/reset UFW tanpa menyiapkan aturan akses SSH/web yang sedang dipakai. Bila policy output dibatasi, izinkan dari Ubuntu ke IP ZeroTier MikroTik untuk TCP port API dan UDP 3799. Paket balasan RADIUS harus dapat kembali ke router. Jika port auth di NAS berbeda, sesuaikan listener/aturan firewall juga.

## 5. Bukti koneksi

1. `sudo zerotier-cli listnetworks` pada Ubuntu dan `/zerotier interface print` pada MikroTik: network yang sama dan status OK; bukan ACCESS_DENIED.
2. Ping IP ZeroTier kedua arah jika ICMP diizinkan. Bila gagal, periksa authorize, subnet/Managed IP, interface, internet, dan firewall.
3. Tombol **Cek Router** di Klien VPN mengakses API melalui IP ZeroTier dan membaca network/status/IP. Tes ini tidak mengubah router dan belum membuktikan autentikasi RADIUS.
4. Lakukan dial PPPoE dengan akun uji yang tidak tertimpa secret lokal. Periksa log FreeRADIUS, `/radius monitor`, `/ppp active print`, accounting `radacct`, dan limit paket. Uji disconnect/CoA terpisah.
5. Status Aktif di tabel hanya status pencatatan aplikasi, bukan tanda node online atau telah authorized.

## Migrasi aplikasi

Perubahan schema membutuhkan `20261015_zerotier_clients.sql`, terdaftar dalam runner migrasi. Jalankan migrasi sebelum backend versi baru dimulai. Gunakan alur update production biasa; jangan `db push --force-reset`.

```bash
# Dari root project di server, melalui alur update yang biasa dipakai:
npm run update
```

Migrasi menambahkan field ZeroTier dan mengizinkan relasi server/key publik lama menjadi NULL. Tabel/kunci WireGuard lama tidak dihapus otomatis. Catatan lama tetap terlihat sebagai WireGuard lama, tidak dihitung sebagai anggota ZeroTier, tidak ditawarkan pada NAS baru, dan harus diedit/dikonversi atau dilepas hubungannya sebelum migrasi router. Mengonversi catatan membersihkan referensi/key WireGuard pada catatan tersebut; simpan backup bila masih diperlukan untuk rollback perangkat.

Klien yang sedang dipakai NAS tidak dapat dihapus, diganti identitasnya, atau dinonaktifkan sampai hubungannya dilepas. Perubahan server RADIUS yang dipakai router juga ditolak untuk menghindari alamat sumber/target yang tidak sinkron. Saat menghapus node, lakukan leave di perangkat dan deauthorize di Central; pencatatan web sendiri tidak melepaskan slot Central.

## Referensi resmi

- Harga/batas dan akses API Central: https://www.zerotier.com/pricing/
- Instalasi Linux: https://www.zerotier.com/download/
- Join, authorize, Node ID: https://docs.zerotier.com/start/
- MikroTik ZeroTier dan ARM/ARM64: https://help.mikrotik.com/docs/spaces/ROS/pages/83755083/ZeroTier
- Jaringan VirtualBox: https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/networkingdetails.html
- SQL clients FreeRADIUS 3.2: https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-available/sql

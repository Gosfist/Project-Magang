# Klien VPN WireGuard: catat IP Server RADIUS dan MikroTik

Halaman **Router → Klien VPN** mencatat alamat WireGuard yang sudah dikonfigurasi pada perangkat. Form tambah cukup **Jenis Perangkat** (Server RADIUS / MikroTik) dan **IP VPN**. Status aktif dapat diubah saat edit; status ini adalah pencatatan aplikasi, bukan status online atau pengaturan peer.

VPN boleh dibuat sendiri pada VPS / gateway yang dapat dijangkau, atau memakai penyedia WireGuard. Backend/web/RADIUS dapat berjalan pada VPS maupun Ubuntu lokal/VirtualBox. IP mengikuti konfigurasi masing-masing, tanpa subnet /24 tetap, alamat server .1 wajib, endpoint publik, key, atau paket langganan yang disimpan di aplikasi.

## Topologi yang didukung

```text
Server RADIUS Ubuntu lokal ── WireGuard ── VPS/gateway VPN ── WireGuard ── MikroTik

atau

VPS RADIUS + gateway WireGuard ── WireGuard ── MikroTik
```

Jika memakai layanan orang lain, pastikan layanan memberi konektivitas antarpeer / site-to-site. Layanan VPN yang hanya menyediakan akses internet atau mengisolasi klien tidak cukup untuk API/RADIUS. Server RADIUS dan MikroTik tidak harus berada pada satu LAN atau menggunakan subnet IP VPN yang sama selama routing dan AllowedIPs sudah benar.

## Setup awal di luar web

1. Buat / dapatkan konfigurasi WireGuard tersendiri untuk server RADIUS dan setiap MikroTik. Private key setiap perangkat harus berbeda. Terapkan konfigurasi tersebut langsung pada Ubuntu dan MikroTik; aplikasi tidak mengimpor atau membuat key/config VPN.
2. WireGuard tersedia pada RouterOS 7, termasuk hEX MMIPS. Periksa `/interface wireguard print`. Batas ARM/ARM64 pada fitur VPN sebelumnya tidak berlaku pada WireGuard.
3. Bila Ubuntu berada di VirtualBox, jalankan WireGuard di **VM Ubuntu yang menjalankan backend/RADIUS**, bukan hanya pada host Windows. VM perlu internet. Bridged Adapter memudahkan akses web lewat LAN; NAT VirtualBox dapat dipakai untuk koneksi keluar dengan pengaturan akses web yang sesuai.
4. Pastikan AllowedIPs, route, dan firewall mengizinkan server RADIUS menjangkau IP VPN MikroTik dan sebaliknya. Untuk topologi melalui gateway, gateway perlu IP forwarding serta izin forwarding antarpeer. Pertahankan IP sumber VPN asli untuk trafik RADIUS, jangan di-masquerade menjadi IP gateway sebelum sampai server RADIUS.
5. Untuk peer di belakang NAT, persistent keepalive 25 detik dapat menjaga mapping NAT. Endpoint VPS/gateway harus dapat dijangkau melalui UDP dari perangkat. Jangan memakai profil yang sama pada dua perangkat.

Contoh IP berikut hanya ilustrasi: Ubuntu `10.66.66.10`, MikroTik A `10.66.66.20`, MikroTik B `10.66.66.30`. Masukkan IP yang benar-benar terpasang pada perangkat Anda.

## Langkah di aplikasi

1. Pada Klien VPN tambahkan **Server RADIUS** dengan IP VPN Ubuntu / VPS RADIUS. Hanya satu catatan RADIUS diperbolehkan untuk backend ini; catatan itu tidak menjadi pilihan MikroTik di Router / NAS.
2. Tambahkan **MikroTik** dengan IP VPN tiap router. IP tidak boleh dipakai perangkat lain, termasuk catatan nonaktif. Isi alamat IPv4 tanpa `/24` atau `/32`, tanpa port, dan tanpa domain endpoint VPN.
3. Pada **Router / NAS**, pilih catatan WireGuard MikroTik. IP API dan IP NAS otomatis mengikuti alamat tersebut. Isi kredensial API, port API, dan shared secret RADIUS. Catatan Server RADIUS harus aktif sebelum NAS dapat dihubungkan ke klien VPN.
4. Jalankan **Script RADIUS** dari Router / NAS pada router yang sesuai. Alamat tujuan RADIUS mengikuti IP VPN catatan Server RADIUS, dan `src-address` mengikuti IP VPN MikroTik. Target RADIUS tidak diambil dari IP publik gateway VPN atau dugaan alamat LAN backend.
5. Gunakan **Cek Router** di Klien VPN / tes koneksi pada Router / NAS, lalu uji dial PPPoE dan accounting secara nyata.

Koneksi Router / NAS langsung melalui LAN tetap tersedia dengan pilihan **Koneksi langsung / LAN**. Mode tersebut tidak mewajibkan catatan WireGuard.

## Port dan bukti koneksi

- Ubuntu/backend → MikroTik: TCP port API NAS (biasanya 8728), ICMP bila dipakai, UDP CoA 3799.
- MikroTik → Ubuntu RADIUS: UDP autentikasi 1812 dan accounting 1813, atau port yang dikonfigurasi server.
- Jika API MikroTik memakai address whitelist, tambahkan IP VPN Ubuntu `/32` ke whitelist yang sudah ada. Sesuaikan firewall input MikroTik agar menerima trafik API/CoA dari IP VPN Ubuntu.
- FreeRADIUS harus mendengarkan alamat yang dapat dijangkau melalui VPN dan membaca NAS dari SQL dengan IP serta shared secret yang sama. Validasi dengan `sudo freeradius -XC`; muat ulang daftar NAS sesuai konfigurasi FreeRADIUS setelah mengubah NAS.

Contoh pemeriksaan manual (sesuaikan nama interface dan IP):

```bash
# Ubuntu
sudo wg show
ip -4 address
ip -4 route get 10.66.66.20
ping -c 5 10.66.66.20
```

```routeros
/interface wireguard print
/interface wireguard peers print
/ip address print
/ping 10.66.66.10 count=5
```

Jangan membagikan output yang berisi private key / preshared key. Cek Router aplikasi hanya membaca identitas API, nama/status interface WireGuard dan alamat IP memakai proplist yang membatasi field; tidak membaca key dan tidak mengubah router. Keberhasilan cek menunjukkan API dapat dijangkau melalui IP tercatat dan IP terpasang pada interface WireGuard aktif. Itu bukan bukti dial PPPoE, Access-Accept, accounting atau CoA; uji alur tersebut terpisah.

## Perubahan dan penghapusan

Menyimpan catatan segera memperbarui database web; tidak ada Setup Ubuntu / unduhan profil yang perlu dijalankan ulang dari aplikasi. Jika IP atau konfigurasi WireGuard diubah, terapkan perubahan pada perangkat/VPS/provider terlebih dahulu, kemudian sesuaikan catatan web dan Script RADIUS bila diperlukan.

Catatan MikroTik yang masih dipilih pada NAS dilindungi dari perubahan IP/jenis/nonaktif/hapus. Catatan Server RADIUS juga dilindungi selama ada NAS yang terhubung ke catatan WireGuard. Lepas/ganti hubungan VPN NAS sebelum mengganti identitas server/router. Menghapus atau menonaktifkan catatan web tidak mencabut akses peer; pencabutan key dilakukan pada VPS / penyedia VPN.

Pengaturan, profil `.ovpn`, endpoint Portmap, generator sertifikat/script provisioning, dan API provisioning dari konsep sebelumnya dihapus. Catatan database lama tetap dipertahankan dan tidak dikonversi otomatis menjadi WireGuard karena alamat lama belum membuktikan konfigurasi perangkat. Buat catatan WireGuard baru lalu ganti pilihan pada NAS. Migrasi SQL idempotent `20261017_wireguard_clients.sql` menambahkan pembeda `vpn_type` bila belum tersedia; tidak mereset database atau mengganti IP NAS lama.

Jika setup VPN sebelumnya sudah pernah diterapkan pada mesin, penggantian aplikasi tidak menghentikan service OS otomatis. Setelah WireGuard teruji dan tidak ada akses lain bergantung pada service lama, administrator dapat menghentikan service OpenVPN/Portmap khusus aplikasi yang sudah tidak digunakan. Jangan menghapus key, route, atau service VPN lain tanpa memeriksa dependensinya.

## Sumber resmi

- [MikroTik WireGuard: interface, peers, AllowedIPs dan persistent keepalive](https://help.mikrotik.com/docs/spaces/ROS/pages/69664792/WireGuard)
- [MikroTik: dukungan berdasarkan arsitektur](https://manual.mikrotik.com/docs/getting-started/software-specifications/feature-support-based-on-architecture/)
- [WireGuard quick start](https://www.wireguard.com/quickstart/)

Build dan tes otomatis memakai mock database/RouterOS. Koneksi VPS/provider, VM Ubuntu, WireGuard hEX dan dial PPPoE nyata tetap perlu diverifikasi pada lingkungan yang dipakai.

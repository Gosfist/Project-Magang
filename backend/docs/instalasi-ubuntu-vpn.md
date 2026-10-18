# Instalasi UNZANET tanpa API MikroTik

Panduan ini menyiapkan Ubuntu Server 24.04 LTS di VirtualBox, MySQL, backend NestJS, frontend Angular, bot WhatsApp, dan FreeRADIUS. Mulai dengan MikroTik fisik sampai ping dua arah berhasil. Lalu pilih sambungan LAN untuk lab atau SSTP untuk router berbeda lokasi. Aplikasi tidak meminta atau menyimpan username/password admin atau API MikroTik. Administrator memasang konfigurasi perangkat dengan menyalin script web ke Terminal MikroTik.

## 1 Arsitektur dan alamat contoh

Autentikasi memakai RADIUS RFC 2865 pada UDP 1812; accounting memakai RFC 2866 pada UDP 1813. Pemutusan sesi memakai Disconnect Request RFC 5176 pada UDP 3799. RFC 5176 menggantikan RFC 3576. Port 3799 adalah listener pada MikroTik sebagai tujuan permintaan server, bukan port autentikasi Ubuntu. Tidak ada koneksi RouterOS API TCP 8728/8729 atau monitoring SNMP.

| Sambungan | Ubuntu RADIUS | MikroTik NAS | Jalur |
| --- | --- | --- | --- |
| Lab LAN fisik | 192.168.10.3/29 | 192.168.10.1/29 | Bridged Adapter ke Ethernet fisik |
| Cloud SSTP | 10.88.0.2 | 10.88.0.3 | Dua klien ke gateway VPN 10.88.0.1 |

Alamat di atas merupakan contoh; periksa konflik sebelum dipakai. IP management, subnet VPN, pool PPPoE internet, dan subnet isolir harus berbeda. Trafik internet pelanggan tetap melalui WAN MikroTik. VPN cukup membawa RADIUS, accounting, Disconnect, serta ping.

Database menyimpan metadata NAS, IP sumber RADIUS, tujuan Disconnect, dan shared secret RADIUS yang masih diperlukan protokol. Password SSTP router hanya digunakan untuk menghasilkan script saat Simpan; tidak disimpan di tabel NAS. Password SSTP Ubuntu disimpan privat pada Ubuntu agar tunnel dapat menyambung otomatis. Password PPPoE pelanggan tetap diperlukan untuk autentikasi.

## 2 Membuat VM dari awal

1. Unduh ISO Ubuntu Server 24.04 LTS dari situs Ubuntu dan pasang Oracle VirtualBox di Windows. Siapkan MikroTik fisik, kabel Ethernet, serta akses Winbox lokal.
2. Pilih New, nama Ubuntu UNZANET, ISO Ubuntu Server, Linux dan Ubuntu 64 bit. Gunakan pemasangan manual jika muncul pilihan unattended.
3. Alokasikan awal 2 CPU, RAM 4 GB, dan disk dinamis 40 GB untuk lab. Ini ukuran awal pengujian, bukan jaminan kapasitas produksi. Sisakan RAM Windows saat build.
4. Di Settings lalu Network, pasang Adapter 1 sebagai NAT untuk internet VM. Pasang Adapter 2 sebagai Bridged Adapter, pilih NIC Ethernet fisik yang kabelnya menuju LAN management MikroTik, dan centang Cable Connected. Jangan pilih VirtualBox Host Only untuk menghubungi router fisik.
5. Hubungkan kabel Ethernet laptop ke port LAN management router. Internet laptop/VM dapat berasal dari Wi Fi melalui adapter NAT. Port WAN dan port pelanggan PPPoE dipilih terpisah sesuai topologi.
6. Jalankan Install Ubuntu Server. Atur bahasa dan keyboard, pilih disk virtual baru, buat akun Linux sendiri, dan aktifkan Install OpenSSH Server. Jangan memilih disk fisik Windows.
7. Setelah selesai, reboot dan lepaskan ISO. Login dengan akun Linux tadi. Buat snapshot Ubuntu sebelum UNZANET.

Satu Bridged Adapter juga bisa dipakai jika internet, laptop, dan MikroTik berada pada LAN yang sama. Dua adapter di atas memisahkan internet VM dari lab fisik. Nama interface tidak selalu sama; cocokkan MAC address dari VirtualBox.

## 3 Mengatur jaringan dan ping MikroTik

Periksa interface, alamat, dan route aktual di Ubuntu:

~~~bash
ip -br link
ip -4 -br address
ip -4 route
~~~

Contoh berikut menganggap enp0s3 adalah NAT dan enp0s8 adalah Bridged Ethernet. Ganti jika output berbeda. Dari Winbox Terminal periksa router:

~~~routeros
/interface print
/ip address print
~~~

Bila router lab belum mempunyai IP management, ganti PORT_LAN_MANAGEMENT dengan port yang benar dan tambahkan alamat contoh. Jangan mengubah port WAN atau menghapus alamat router yang sedang melayani pelanggan.

~~~routeros
/ip address add address=192.168.10.1/29 interface=PORT_LAN_MANAGEMENT comment="Lab Ubuntu RADIUS"
~~~

Pada Ubuntu periksa Netplan bawaan dan buka konfigurasi lab:

~~~bash
ls /etc/netplan
sudo nano /etc/netplan/60-unzanet-lab.yaml
~~~

Isi contoh berikut. NAT menggunakan DHCP sebagai satu satunya default route. Adapter menuju MikroTik memakai IP statis tanpa gateway tambahan.

~~~yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: false
      addresses:
        - 192.168.10.3/29
~~~

Jika file bawaan mengatur interface yang sama, sesuaikan file yang ada agar tidak bertentangan. Gunakan indentasi spasi. Jalankan dari console VM supaya pemulihan jaringan tetap tersedia.

~~~bash
sudo chmod 600 /etc/netplan/60-unzanet-lab.yaml
sudo netplan generate
sudo netplan try
ip -4 route get 192.168.10.1
ping -c 5 192.168.10.1
ping -c 3 1.1.1.1
getent hosts github.com
~~~

Lanjut setelah ping router, internet, dan DNS berhasil. Pada MikroTik uji arah balik:

~~~routeros
/ping 192.168.10.3 count=5
~~~

Ethernet Windows dapat diberi alamat lain yang masih kosong, misalnya 192.168.10.2/29, agar browser/SSH dapat mengakses VM. Ethernet lab tidak membutuhkan default gateway jika Wi Fi sudah menyediakan internet laptop. Jika ping gagal, cek kabel, NIC Bridged fisik, mask, IP duplikat, route, dan firewall input router.

## 4 Memilih LAN atau SSTP

Pilih mode local pada installer untuk menguji end to end tanpa VPS. Isi RADIUS 192.168.10.3, NAS dan tujuan Disconnect 192.168.10.1, subnet 192.168.10.0/29, URL web http://192.168.10.3. Lanjut ke bagian 6.

Untuk mode vpn, Ubuntu dan setiap router menjadi klien SSTP ke gateway. Contoh host vpn.example.net, gateway tunnel 10.88.0.1, akun Ubuntu vpn_radius dengan IP tetap 10.88.0.2, dan akun router vpn_router01 dengan IP tetap 10.88.0.3. Ganti host contoh dengan gateway milikmu. Setiap NAS tambahan perlu akun dan IP unik.

## 5 Gateway dan sertifikat SSTP

Lewati untuk mode local. Jika gateway sudah tersedia, tidak perlu memasang ulang. Gateway harus meneruskan paket antarpeer tanpa masquerade sehingga sumber NAS tetap 10.88.0.3. Klien memerlukan akses keluar TCP 443 ke gateway; Cloud Firewall gateway menerima TCP 443 tanpa mempublikasikan UDP RADIUS.

Pada VPS Ubuntu 24.04 baru yang khusus menjadi gateway dan port 443 belum dipakai, repo menyediakan installer berikut. Jalankan pada VPS, bukan VM aplikasi. Ganti IP_PUBLIK_VPS sebelum menjalankan.

~~~bash
sudo apt update
sudo apt install -y git ca-certificates
git clone https://github.com/Gosfist/Project-Magang.git ~/Project-Magang-Gateway
cd ~/Project-Magang-Gateway
sudo bash install-sstp-ubuntu24.sh IP_PUBLIK_VPS
sudo systemctl status accel-ppp --no-pager -l
sudo accel-cmd show sessions
~~~

Installer berhenti bila konfigurasi Accel PPP sudah ada. Akun disimpan privat di /root/sstp-accounts.txt; CA publik untuk klien ada di /root/sstp-ca.crt. Jangan mengirim file .key ke klien. Sertifikat server berlaku 365 hari; perbarui sebelum kedaluwarsa. Host/IP klien harus cocok SAN sertifikat.

Salin CA publik ke Ubuntu aplikasi melalui jalur tepercaya, cocokkan fingerprint dengan pengelola gateway, lalu pasang:

~~~bash
sudo install -m 644 sstp-ca.crt /usr/local/share/ca-certificates/unzanet-sstp.crt
sudo update-ca-certificates
~~~

Upload CA publik melalui Files Winbox, lalu impor pada MikroTik:

~~~routeros
/certificate import file-name=sstp-ca.crt passphrase=""
/certificate print
/certificate set [find where common-name="UNZANET-SSTP-CA"] trusted=yes
~~~

Perintah terakhir sesuai nama CA buatan installer. Untuk CA lain gunakan nama yang benar dari hasil print. Sinkronkan waktu kedua perangkat. Script web memakai verify-server-certificate=yes dan klien Ubuntu tidak memakai --cert-warn. Jangan mematikan validasi sertifikat untuk memaksa VPN tersambung.

Installer gateway awal mengizinkan pasangan .2 dan .3 untuk UDP 1812/1813, UDP 3799, balasan koneksi, dan ping; forwarding antarpeer lain ditolak. NAS tambahan memerlukan akun dan aturan setara. Port Disconnect yang diubah juga perlu disesuaikan pada gateway.

## 6 Mengambil repo dan memasang aplikasi

Pastikan revisi kode ini sudah tersedia pada remote Git yang di-clone. Perubahan yang hanya tersimpan di komputer pengembangan belum ikut terambil VM. Jalankan dengan akun Linux yang memiliki sudo:

~~~bash
sudo apt update
sudo apt install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-22.sh
sudo bash /tmp/nodesource-22.sh
sudo apt install -y nodejs
node --version
npm --version
sudo install -d -o "$USER" -g "$(id -gn)" /var/www/Project-Magang
git clone https://github.com/Gosfist/Project-Magang.git /var/www/Project-Magang
cd /var/www/Project-Magang
npm run install
~~~

Node.js harus 22.x. Installer berjalan dari root repo di bawah /var/www tanpa spasi dan meminta sudo jika diperlukan. Gunakan autentikasi Git milikmu jika repo privat; jangan menaruh token di perintah yang dibagikan.

Installer menanyakan URL web, mode local/vpn, IP RADIUS/NAS/subnet, dan email administrator. Mode vpn juga meminta gateway serta akun khusus Ubuntu; akun router diisi nanti pada Tambah Router. Password prompt tidak ditampilkan. Konfigurasi dan secret disimpan privat pada /etc/unzanet/install.json.

Installer memasang paket Ubuntu, dependency aplikasi, MySQL, Apache, FreeRADIUS SQL, serta systemd. Skema backend/prisma/database.sql hanya diimpor ke database kosong. Administrator dibuat dengan password acak; seed demo tidak dijalankan. Frontend dibangun untuk Apache, bukan ng serve. Bot menggunakan proxy /api/wa sehingga port 3002 tidak perlu dibuka ke jaringan.

Mode local membatasi RADIUS dari NAS pertama. Untuk NAS lokal tambahan, tambahkan UFW dari alamat NAS itu ke IP Ubuntu pada UDP 1812/1813. Mode vpn membatasi RADIUS ke interface tunnel dan subnet VPN. MySQL dan backend internal tidak perlu dibuka ke internet.

Lihat login awal secara privat lalu ganti password melalui profil web:

~~~bash
sudo cat /etc/unzanet/credentials.txt
~~~

Backup database, uploads, dan secret installer. Pertahankan JWT_SECRET ketika memulihkan database karena juga dipakai enkripsi password PPPoE. Jangan membagikan isi .env atau file kredensial.

## 7 Memeriksa service Ubuntu

~~~bash
sudo systemctl status mysql apache2 freeradius --no-pager
sudo systemctl status unzanet-backend unzanet-botwa --no-pager
curl -i http://127.0.0.1:3001/api/auth/me
curl http://127.0.0.1/api/wa/health
sudo systemctl status unzanet-radius-nas-refresh.timer --no-pager
sudo ss -lunp
~~~

Respons 401 pada /api/auth/me membuktikan backend/guard menjawab tanpa login. Health bot harus sehat. FreeRADIUS mendengarkan UDP 1812/1813; Ubuntu tidak perlu mendengarkan 3799 karena server mengirim permintaan ke router. Buka URL web dari laptop.

Khusus mode vpn:

~~~bash
sudo systemctl status sstp-radius --no-pager -l
ip -4 address show sstp-radius
ip -4 route show dev sstp-radius
ping -c 5 10.88.0.1
~~~

Interface harus mendapat 10.88.0.2 dan route subnet VPN. Service aktif saja tidak membuktikan IP tersedia. Jika VM lama masih menggunakan akun/IP yang sama, hentikan SSTP di VM lama dengan sudo systemctl stop sstp-radius.

## 8 Tambah Router dan script otomatis

Buka Router lalu Tambah Router dan isi alamat sesuai mode:

| Field | LAN lab | Cloud SSTP |
| --- | --- | --- |
| Nama | MikroTik Lab | MikroTik Cabang 01 |
| IP sumber NAS | 192.168.10.1 | 10.88.0.3 |
| IP tujuan Disconnect | 192.168.10.1 | 10.88.0.3 |
| IP server RADIUS | 192.168.10.3 | 10.88.0.2 |
| Port autentikasi | 1812 | 1812 |
| Port Disconnect | 3799 | 3799 |
| Host dan username SSTP | Kosong | Gateway aktual dan vpn_router01 |
| Password SSTP | Kosong | Password akun router untuk script kali ini |

Shared secret RADIUS dapat dibuat acak oleh web. Klik Simpan; dialog script terbuka otomatis. Pilih RouterOS yang sesuai, salin seluruh script, dan paste di Terminal router tujuan. Script berisi shared secret dan mungkin password VPN; simpan privat. Simpan di web belum membuktikan perangkat sudah dikonfigurasi.

Script mengatur entri RADIUS, sumber IP NAS, accounting lima menit, incoming Disconnect, serta rule yang menerima Disconnect dari IP RADIUS saja. Jika host, username, dan password VPN diisi, script juga membuat SSTP. Password VPN tidak tersimpan; isi ulang untuk membuat ulang bagian tunnel.

Script web menambahkan route /32 menuju server RADIUS melalui tunnel terkelola jika data VPN diisi. Periksa route yang dihasilkan; jangan menambahkan contoh ini bila route tersebut sudah ada. Untuk tunnel manual yang belum mempunyai jalur NAS menuju RADIUS, contoh fallback berikut memakai nama tunnel yang sebenarnya:

~~~routeros
/ip route add dst-address=10.88.0.2/32 gateway=radius-cloud-ID_ROUTER comment="UNZANET route RADIUS"
~~~

Ganti ID_ROUTER sesuai interface yang dihasilkan. Periksa route lama agar tidak ganda. Tidak perlu mengubah default route internet pelanggan. Uji dua arah:

~~~routeros
/ping 10.88.0.2 src-address=10.88.0.3 count=5
~~~

~~~bash
ip -4 route get 10.88.0.3
ping -c 5 10.88.0.3
~~~

Untuk LAN ganti alamat dengan .10.1 dan .10.3. Bila ping diblokir firewall router, izinkan ICMP hanya dari IP server pada interface yang benar setelah meninjau rule yang ada. Ping belum membuktikan autentikasi atau Disconnect.

## 9 Penerapan client NAS

FreeRADIUS dengan read_clients=yes membaca tabel nas ketika proses mulai. Installer menyediakan timer unzanet-radius-nas-refresh sekitar setiap 60 detik. Worker root membaca konfigurasi client aktif, membandingkan fingerprint, memvalidasi freeradius -XC, lalu restart hanya jika client berubah. Fingerprint sukses lama dipertahankan ketika validasi/restart gagal agar dicoba ulang. Secret tidak dicetak ke journal.

Backend tidak diberi sudo. Worker root dipasang di /usr/local/lib/unzanet, bukan dijalankan dari file yang dapat ditulis web. Perubahan IP/secret/status NAS menunggu timer. Restart singkat memengaruhi permintaan RADIUS baru; sesi PPPoE aktif tetap berada pada router.

~~~bash
sudo systemctl list-timers unzanet-radius-nas-refresh.timer --no-pager
sudo systemctl start unzanet-radius-nas-refresh.service
sudo systemctl status unzanet-radius-nas-refresh.service --no-pager
sudo systemctl status freeradius --no-pager -l
~~~

Kegagalan rinci tersimpan privat pada /var/lib/unzanet-radius/last-error.log. Instalasi manual tanpa worker harus memvalidasi lalu restart FreeRADIUS setelah perubahan NAS. Jangan memberikan sudo kepada proses web.

## 10 PPPoE dan pool pelanggan

Script NAS tidak menebak port pelanggan atau membuat server PPPoE/gateway normal. Pertahankan konfigurasi yang sudah benar. Untuk router lab kosong, contoh berikut memakai subnet pelanggan 192.168.75.0/24 yang berbeda dari management/VPN. Ganti PORT_PELANGGAN dahulu dan jangan menambah entri yang sudah ada.

~~~routeros
/ip pool add name=pool-pppoe ranges=192.168.75.2-192.168.75.254
/ppp profile add name=pppoe-default local-address=192.168.75.1 remote-address=pool-pppoe dns-server=1.1.1.1,8.8.8.8
/interface pppoe-server server add interface=PORT_PELANGGAN service-name=PPPoE-UNZANET default-profile=pppoe-default authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no
~~~

Local address adalah gateway sisi router dan harus terisi. Jika topologi membutuhkan NAT yang belum dicakup rule yang ada, ganti PORT_WAN dengan interface sebenarnya:

~~~routeros
/ip firewall nat add chain=srcnat src-address=192.168.75.0/24 out-interface=PORT_WAN action=masquerade comment="NAT pelanggan PPPoE"
~~~

Pada web daftarkan nama/rentang pool ke router yang tepat. Simpan lalu pasang script yang dihasilkan. Daftar pool menyimpan metadata/rencana, tidak membaca konfigurasi perangkat. Pool manual didaftarkan dengan nama/rentang sama; tinjau script sebelum paste. Pool lama tanpa NAS perlu dihubungkan ke router yang benar.

Harga Paket mengirim nama pool sebagai Framed-Pool; nama itu harus tersedia pada setiap router yang melayani paket. Penggunaan dan IP tersedia pada pool tidak dipantau; web menampilkan tidak diketahui, bukan nol atau alokasi pasti. RADIUS tidak membuat pool, profil, firewall, atau server PPPoE.

## 11 Uji pelanggan dan accounting

Buat Harga Paket serta akun pelanggan uji di web dengan NAS yang benar. Aplikasi mengisi radcheck/radreply tanpa membuat PPP secret lokal. Jangan membuat /ppp secret dengan username sama karena RouterOS mendahulukan akun lokal.

Dial dari perangkat pelanggan yang benar benar terhubung ke port PPPoE, lalu periksa:

~~~routeros
/radius print
/radius monitor [find where service=ppp]
/ppp aaa print
/ppp active print
~~~

~~~bash
sudo mysql unzanet -e "SELECT username,nasipaddress,framedipaddress,acctstarttime,acctupdatetime,acctstoptime FROM radacct ORDER BY radacctid DESC LIMIT 5;"
~~~

Sesi harus memakai NAS yang benar; uji IP pelanggan, internet, dan batas kecepatan. Accounting mengirim Start/Stop saat sesi berubah dan Interim Update lima menit. RADIUS_ACCOUNTING_STALE_SECONDS=900 adalah batas awal kesegaran. Data terlambat tidak menjadi bukti pasti pelanggan online. Accounting bukan grafik per detik. Monitoring CPU/RAM/interface/log router sudah dihapus; monitoring server dan RADIUS tetap ada.

RADIUS_ACCOUNTING_TIMEZONE=WIB sesuai DATETIME lokal Jakarta yang ditulis query MySQL installer. Jika instalasi lama menyimpan accounting UTC, gunakan UTC; jangan mengubah interpretasi tanpa memeriksa waktu data. Timezone accounting terpisah dari timezone log. NTP kedua perangkat harus benar.

Simultaneous Use tetap satu sesi. Query SQL menghitung hanya sesi yang segar dan memakai simul_verify_query kosong agar tidak menjalankan checkrad/SNMP. Signed Disconnect ACK atau NAK 503 mendapat penanda sesi sehingga accounting terlambat tidak menahan reconnect, tanpa menulis Accounting Stop palsu. Ketepatan batas sesi bergantung pada accounting. Bila batas stale backend diubah dari 900 detik, sesuaikan juga interval pada simul_count_query SQL.

Untuk debug, hentikan service agar port tidak dipakai dua proses:

~~~bash
sudo systemctl stop freeradius
sudo freeradius -X
~~~

Selesai debug tekan Ctrl C lalu sudo systemctl start freeradius. Debug dapat memuat password dan shared secret; jangan membagikan log mentah.

## 12 Uji Disconnect dan isolir

Gunakan Putus Sesi pada pelanggan uji yang aktif. Backend mengirim Disconnect berisi identitas username/sesi, memeriksa ACK/NAK, dan menangani timeout/retry. ACK membuktikan NAS menerima permintaan; periksa sesi router benar benar berhenti/reconnect dan accounting mengikuti. Ping/port terbuka tidak membuktikan Disconnect.

Untuk isolir, daftarkan pool terpisah misalnya 192.168.100.2 sampai 192.168.100.254, subnet 192.168.100.0/24, gateway 192.168.100.1. Pada Isolir PPPoE isi konfigurasi lalu buat script. Script memasang pool/profil serta tiga drop rule sebelum accept/FastTrack. Paste pada NAS tujuan dan periksa hasilnya. Baru kemudian konfirmasikan pemasangan pada web. Konfirmasi operator bukan verifikasi isi perangkat otomatis.

Sesudah konfirmasi, backend memperbarui atribut RADIUS dan memutus sesi yang perlu berpindah IP. Pelanggan reconnect ke pool isolir. Uji bahwa PPPoE tetap terhubung tetapi akses internet/layanan router diblokir. Uji ACC pembayaran atau janji bayar mengembalikan pool normal melalui reconnect. Perubahan pool memerlukan sesi baru.

Pemeriksaan masa aktif berjalan berkala; tidak ada jaminan seluruh proses kurang dari satu detik. Kegagalan Disconnect tidak membatalkan status yang telah disimpan. Perbaiki konektivitas lalu coba ulang/sinkron ulang. Menonaktifkan mode mempertahankan rule drop router agar sesi isolir yang belum terputus tidak terbuka aksesnya. Bersihkan manual setelah memeriksa sesi.

## 13 Database untuk VirtualBox baru

Semua perubahan skema sudah langsung berada pada backend/prisma/database.sql. Buat VM Ubuntu baru dan database kosong, lalu jalankan installer dari root repo:

~~~bash
cd /var/www/Project-Magang
npm run install
~~~

Installer mengimpor database.sql sekali ketika database kosong. Skema sudah berisi metadata NAS, shared secret RADIUS, tujuan/port Disconnect, metadata VPN nonsensitif, dan pool per NAS. IP sumber NAS dibuat unik. Kolom username/password/port API dan tabel statistik router tidak dibuat. Tidak ada file atau langkah migrasi database lama.

Untuk pemeriksaan sumber sebelum instalasi, jalankan npm run database:check dari root repo. Pemeriksaan ini membandingkan SQL dengan skema Prisma tanpa terhubung ke database. Bila skema diubah, npm run database:generate memperbarui SQL lengkap. npm run update hanya memperbarui aplikasi dan service; tidak mengimpor ulang SQL atau mengubah skema.

Installer juga memasang worker NAS root. Setelah instalasi, isi IP server RADIUS, tujuan Disconnect, dan NAS di web; simpan lalu paste script pada router. Daftarkan pool per NAS dan pasang script pool. FreeRADIUS manual harus memakai read_clients=yes dan client_query yang hanya membaca NAS aktif. Perubahan web tidak menonaktifkan layanan API perangkat secara otomatis.

Jika layanan lain tidak memerlukan API, nonaktifkan melalui Terminal:

~~~routeros
/ip service set [find where name="api"] disabled=yes
/ip service set [find where name="api-ssl"] disabled=yes
~~~

Script NAS menambahkan rule yang menolak koneksi TCP baru dari IP server RADIUS ke router. Ini membatasi akses administrasi dari server billing tanpa memutus balasan SSTP yang dimulai router. Audit juga akses dari alamat lain; pengelolaan administrator tetap memakai jalurnya sendiri.

## 14 Pemulihan dan pekerjaan akhir

Scan QR Bot WhatsApp dengan ponsel pemilik akun. Isi area, petugas, biaya, paket, dan data operasional. Produksi memerlukan domain/HTTPS, origin backend/bot yang benar, serta firewall; installer awal menyajikan HTTP untuk lab.

Installer tidak mereset database saat dijalankan ulang. Jika database sudah berisi data dan skemanya berbeda, installer berhenti. Jika impor pertama putus dan tabel hanya terisi sebagian tanpa penanda installer, kembali ke snapshot VM atau buat VM baru untuk lab kosong. Jangan menghapus database produksi untuk memaksa installer lanjut.

| Gejala | Pemeriksaan |
| --- | --- |
| LAN tidak dapat ping router | NIC Bridged fisik, kabel, IP/mask, route, firewall input |
| Web tidak terbuka | IP management, Apache, UFW TCP 80 |
| Login web 503 | Service backend, port 3001, journal backend |
| SSTP gagal sertifikat | CA tepercaya, SAN/hostname, masa berlaku, waktu |
| SSTP aktif tanpa IP | Akun/IP gateway, sesi ganda, journal klien |
| Gateway menulis out of client ip range | Bagian client ip range bukan pool tunnel |
| Ping gateway bisa tetapi peer gagal | Dua sesi, route dua arah, forwarding tanpa NAT, firewall |
| Unknown client RADIUS | IP sumber NAS, status aktif, worker refresh, secret |
| Disconnect timeout | Jalur server ke NAS, source IP, UDP 3799, incoming accept |
| Disconnect NAK | Identitas sesi/username/NAS dan kode kesalahan |
| Authenticated lalu remote IP error | Local address/default profile PPP serta pool |
| Status sesi tidak pasti | Stop hilang, Interim Update, waktu, batas stale |
| Installer berhenti karena skema berbeda | Gunakan VM baru atau snapshot database kosong untuk lab ini |

~~~bash
sudo journalctl -u unzanet-backend -n 80 --no-pager
sudo journalctl -u unzanet-botwa -n 80 --no-pager
sudo journalctl -u freeradius -n 80 --no-pager
sudo journalctl -u sstp-radius -n 80 --no-pager
sudo ufw status verbose
~~~

Baca log secara lokal dan samarkan informasi sensitif sebelum dibagikan.

## 15 Keamanan dan sumber

Tanpa password admin router mengurangi risiko kebocoran kredensial manajemen dari billing. Ini bukan jaminan 100 persen aman. Server yang dibobol masih dapat mengekspos data pelanggan/shared secret, mengganggu autentikasi, atau memutus sesi. Lindungi database, backup, akun admin web, VPN, dan firewall. RADIUS UDP tidak mengenkripsi seluruh paket; VPN harus memverifikasi identitas server.

Build, tes protokol lokal, pemeriksaan SQL, dan sintaks script tidak menggantikan VM nyata, ping, dial PPPoE, Start/Stop, Disconnect, firewall isolir, atau QR WhatsApp. Catat bukti lab sebelum migrasi produksi. Kapasitas ratusan pelanggan memerlukan uji beban pada perangkat dan interval yang digunakan.

Sumber resmi:

- RADIUS authentication RFC 2865: https://www.rfc-editor.org/rfc/rfc2865
- Accounting RFC 2866: https://www.rfc-editor.org/rfc/rfc2866
- RFC 5176 pengganti RFC 3576: https://www.rfc-editor.org/rfc/rfc5176
- MikroTik RADIUS: https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS
- MikroTik SSTP: https://help.mikrotik.com/docs/spaces/ROS/pages/2031645/SSTP
- FreeRADIUS SQL startup: https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-available/sql
- FreeRADIUS MySQL queries: https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/mysql/queries.conf
- VirtualBox networking: https://docs.oracle.com/en/virtualization/virtualbox/7.1/user/networkingdetails.html
- Ubuntu sstpc: https://manpages.ubuntu.com/manpages/noble/man8/sstpc.8.html


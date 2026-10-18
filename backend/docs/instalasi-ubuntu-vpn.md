# Instalasi UNZANET dengan internet dinamis dan RADIUS melalui VPN

Selesaikan Ubuntu, database, backend, frontend, dan login website terlebih dahulu. Setelah website dapat dibuka, siapkan VPN Ubuntu dan hubungkan MikroTik di lokasi lain. Internet Ubuntu boleh berasal dari Wi Fi laptop, hotspot, internet rumah, atau jaringan provider. Ubuntu tidak memerlukan IP LAN tertentu dan tidak perlu satu jaringan fisik dengan MikroTik pelanggan.

## 1 Memahami alamat internet website dan tunnel

Ada tiga alamat dengan tugas berbeda. IP internet/LAN Ubuntu mengikuti jaringan tempat server berada dan boleh diperoleh dengan DHCP. URL website adalah alamat yang dibuka pengguna, misalnya port forwarding laptop saat lab atau domain ketika dihosting. IP tunnel RADIUS merupakan alamat privat tetap yang ditetapkan gateway VPN untuk mengenali server dan NAS. Alamat tunnel tidak menggantikan IP internet Ubuntu.

| Alamat | Contoh dalam panduan | Kegunaan |
| --- | --- | --- |
| Jaringan internet Ubuntu | DHCP dari VirtualBox atau provider | Internet keluar untuk update paket dan koneksi VPN |
| Website lab pada Windows | http://127.0.0.1:8080 | Browser laptop diteruskan ke Apache Ubuntu port 80 |
| Website hosting | Domain atau IP akses server yang sebenarnya | Akses pengguna melalui jaringan hosting |
| Gateway SSTP | vpn.example.net dan peer 10.88.0.1 | Titik VPN yang dapat dijangkau melalui internet |
| Tunnel Ubuntu RADIUS | 10.88.0.2 | Alamat privat tetap untuk RADIUS di dalam VPN |
| Tunnel MikroTik pertama | 10.88.0.3 | Identitas NAS dan tujuan Disconnect di dalam VPN |

Semua domain dan alamat tunnel di atas adalah contoh. Ganti dengan data gateway yang digunakan. Setiap NAS memerlukan IP tunnel unik. IP tunnel perlu tetap agar identitas NAS dan shared secret cocok; IP internet rumah/provider tidak wajib statis. Trafik internet pelanggan tetap melewati WAN MikroTik.

Sistem memakai autentikasi RADIUS RFC 2865 pada UDP 1812, accounting RFC 2866 pada UDP 1813, serta Disconnect Request RFC 5176 pada UDP 3799. RFC 5176 menggantikan RFC 3576. Port 3799 berada pada NAS sebagai tujuan permintaan server. Tidak ada login API MikroTik, kredensial admin router, atau monitoring SNMP.

## 2 Memasang Ubuntu di VirtualBox

1. Pasang Oracle VirtualBox pada Windows dan unduh ISO Ubuntu Server 24.04 LTS. MikroTik belum diperlukan pada tahap ini.
2. Pilih New, nama Ubuntu UNZANET, ISO Ubuntu Server, Linux, dan Ubuntu 64 bit. Pilih instalasi manual jika terdapat opsi unattended.
3. Gunakan awal 2 CPU, RAM 4 GB, dan disk virtual dinamis 40 GB untuk lab. Sisakan kapasitas Windows; ukuran ini bukan jaminan kapasitas produksi.
4. Pada Settings lalu Network, cukup aktifkan Adapter 1 sebagai NAT dan centang Cable Connected. Tidak perlu adapter kedua atau kabel langsung ke MikroTik. NAT memakai koneksi internet Windows, termasuk Wi Fi atau hotspot.
5. Jalankan instalasi Ubuntu. Pada konfigurasi jaringan biarkan IPv4 Automatic DHCP. Buat akun Linux sendiri dan aktifkan Install OpenSSH Server bila ingin SSH dari laptop.
6. Selesaikan instalasi, reboot, lepaskan ISO, lalu login pada console VM. Buat snapshot sebelum memasang aplikasi.

Jika Ubuntu dipasang sebagai VPS, gunakan interface dan konfigurasi jaringan yang disediakan provider. Jika memilih Bridged untuk kebutuhan akses LAN laptop, DHCP juga dapat digunakan; pilihan itu tidak berarti MikroTik harus berada di LAN yang sama. Alur utama panduan ini memakai NAT untuk lab dan SSTP untuk router jarak jauh.

Pada Ubuntu, periksa internet dan DNS:

~~~bash
ip -4 -br address
ip -4 route
getent hosts github.com
curl -I https://github.com
~~~

Jangan menimpa alamat DHCP atau menambahkan IP statis untuk mengikuti angka contoh panduan. Nama interface dapat berbeda. Belum perlu ping MikroTik pada tahap ini.

## 3 Menyiapkan akses website dari laptop

Dengan NAT, alamat guest Ubuntu tidak langsung menjadi alamat website pada Windows. Saat VM dimatikan, buka Settings, Network, Adapter 1 NAT, Advanced, lalu Port Forwarding. Buat aturan berikut; biarkan Guest IP kosong agar mengikuti DHCP NAT VirtualBox.

| Nama | Protokol | Host IP | Host Port | Guest Port |
| --- | --- | --- | --- | --- |
| unzanet-web | TCP | 127.0.0.1 | 8080 | 80 |
| unzanet-ssh opsional | TCP | 127.0.0.1 | 2222 | 22 |

Jika port host sudah dipakai, pilih port lain dan gunakan port yang sama pada URL instalasi. Hidupkan VM. Browser Windows nanti membuka http://127.0.0.1:8080; perintah curl di Ubuntu tetap memakai http://127.0.0.1/ pada port 80. Kedua alamat localhost tersebut milik mesin yang berbeda dan terhubung lewat forwarding VirtualBox.

SSH opsional dijalankan dari PowerShell Windows setelah mengganti USER_UBUNTU dengan akun Linux yang dibuat:

~~~powershell
ssh -p 2222 USER_UBUNTU@127.0.0.1
~~~

Port forwarding localhost ini untuk akses laptop sendiri. Untuk website hosting, gunakan alamat/domain yang dapat dijangkau pengguna dan konfigurasi jaringan hosting yang sesuai. IP dinamis dapat menggunakan DNS yang diperbarui atau layanan tunnel/reverse proxy untuk web; jaringan di belakang CGNAT memerlukan jalur masuk yang sesuai. Website publik tidak muncul otomatis hanya karena VM mempunyai internet. Jalur akses web berbeda dari tunnel RADIUS.

## 4 Memasang aplikasi dan database dahulu

Pastikan revisi kode ini sudah tersedia pada remote Git yang di-clone. Perubahan yang hanya ada di komputer pengembangan belum ikut terambil. Pada Ubuntu baru, jalankan dengan akun Linux yang memiliki sudo:

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

Node.js harus 22.x. Repo harus berada di bawah /var/www tanpa spasi. Jika repo privat, gunakan autentikasi Git milikmu tanpa menulis token ke perintah yang dibagikan.

Saat installer bertanya, isi URL browser lab http://127.0.0.1:8080 dan pilih mode web. Pada VPS atau hosting, isi URL akses yang sebenarnya. Mode web menyelesaikan aplikasi tanpa meminta akun VPN, tanpa membuat tunnel, dan tanpa membutuhkan MikroTik. Tidak ada pengaturan IP LAN statis pada Ubuntu.

Installer memasang MySQL, Apache, FreeRADIUS SQL, backend, frontend, bot WhatsApp, dan service systemd. Seluruh skema di backend/prisma/database.sql diimpor sekali ke database kosong. Administrator dibuat dengan password acak; seed demo tidak dijalankan. Konfigurasi privat disimpan di /etc/unzanet/install.json. IP tunnel contoh yang dicatat pada state masih berupa rencana sampai tahap setup VPN, bukan alamat yang dipasang pada interface internet.

Backend dan MySQL tidak perlu dibuka ke internet. Web dan bot diakses melalui proxy Apache; port bot 3002 tidak perlu diteruskan. Mode web belum membuka akses RADIUS dari jaringan luar. Jangan mengulang installer atau mengimpor SQL lagi hanya untuk menyambungkan MikroTik.

## 5 Membuka website sampai berhasil login

Pada Ubuntu, periksa service dan respons internal:

~~~bash
sudo systemctl status mysql apache2 freeradius --no-pager
sudo systemctl status unzanet-backend unzanet-botwa --no-pager
curl -i http://127.0.0.1:3001/api/auth/me
curl http://127.0.0.1/api/wa/health
curl -I http://127.0.0.1/
sudo cat /etc/unzanet/credentials.txt
~~~

Respons 401 pada auth/me membuktikan backend/guard menjawab tanpa login. Buka http://127.0.0.1:8080 pada browser Windows dan login dengan kredensial awal yang dibaca secara privat di Ubuntu. Ganti password melalui profil. Selesaikan tahap ini sebelum mengatur MikroTik. Jika web tidak terbuka, periksa aturan forwarding host 8080 ke guest 80, service Apache/backend, dan firewall; jangan mengganti IP Ubuntu dengan angka contoh.

FreeRADIUS dapat aktif walaupun belum ada NAS. Layanan pelanggan baru berfungsi setelah VPN, pendaftaran NAS, dan pengujian pada tahap berikutnya. Simpan snapshot VM setelah website berhasil dibuka. Backup database, uploads, dan secret installer; JWT_SECRET juga dipakai untuk enkripsi password PPPoE.

## 6 Menyiapkan gateway SSTP setelah website siap

Ubuntu dan MikroTik menjadi dua klien yang menyambung keluar ke gateway SSTP melalui internet masing masing. Keduanya tidak perlu satu LAN. Jika gateway dari pengelola VPN sudah tersedia, minta host, CA tepercaya, akun khusus Ubuntu, serta akun/IP unik per router. Contoh: Ubuntu vpn_radius mendapat 10.88.0.2; MikroTik vpn_router01 mendapat 10.88.0.3. Gateway harus merutekan antarpeer tanpa masquerade dan mengizinkan RADIUS, Disconnect, serta ping.

Jika belum mempunyai gateway, contoh berikut memasangnya pada VPS Ubuntu 24.04 khusus dengan IP publik yang dapat dijangkau dan TCP 443 belum dipakai. Jalankan pada VPS gateway, bukan VM aplikasi. Ganti IP_PUBLIK_VPS dengan alamat VPS yang sebenarnya:

~~~bash
sudo apt update
sudo apt install -y git ca-certificates
git clone https://github.com/Gosfist/Project-Magang.git ~/Project-Magang-Gateway
cd ~/Project-Magang-Gateway
sudo bash install-sstp-ubuntu24.sh IP_PUBLIK_VPS
sudo systemctl status accel-ppp --no-pager -l
sudo accel-cmd show sessions
~~~

Installer berhenti bila konfigurasi Accel PPP sudah ada. Akun awal ada di /root/sstp-accounts.txt; CA publik ada di /root/sstp-ca.crt. Jangan membagikan private key. Host/IP klien harus cocok SAN sertifikat; sertifikat buatan installer berlaku 365 hari dan perlu diperbarui sebelum kedaluwarsa. Gateway awal membatasi forwarding pada pasangan .2 dan .3; NAS tambahan memerlukan akun/IP dan aturan setara.

Salin CA publik ke Ubuntu aplikasi melalui jalur tepercaya dan cocokkan fingerprint dengan pengelola gateway. Di Ubuntu aplikasi:

~~~bash
sudo install -m 644 sstp-ca.crt /usr/local/share/ca-certificates/unzanet-sstp.crt
sudo update-ca-certificates
~~~

## 7 Menyambungkan Ubuntu ke VPN tanpa instal ulang website

Kembali ke Ubuntu aplikasi dan jalankan tahap kedua:

~~~bash
cd /var/www/Project-Magang
npm run setupvpn
~~~

Isi host gateway sesuai sertifikat, username/password SSTP khusus Ubuntu, IP tunnel Ubuntu, rencana IP tunnel router pertama, dan subnet tunnel sesuai data pengelola. Contoh 10.88.0.2, 10.88.0.3, dan 10.88.0.0/24 merupakan alamat privat VPN. Jangan mengisi IP DHCP Wi Fi, IP publik provider, atau URL website pada kolom alamat tunnel.

Tahap ini hanya memasang konfigurasi SSTP Ubuntu, aturan RADIUS pada interface tunnel, dan dua alamat RADIUS pada environment backend. URL website, database, password administrator, JWT_SECRET, dan konfigurasi bot dipertahankan. Website tidak diinstal ulang. Backend direstart untuk membaca pengaturan RADIUS. Password VPN Ubuntu disimpan privat agar dapat reconnect otomatis; klien memverifikasi sertifikat server.

Periksa tunnel dan gateway pada Ubuntu:

~~~bash
sudo systemctl status sstp-radius --no-pager -l
ip -4 address show sstp-radius
ip -4 route show dev sstp-radius
ping -c 5 10.88.0.1
~~~

Alamat interface harus sesuai IP tunnel Ubuntu dari gateway. Jika belum mendapat IP, periksa CA/hostname, akun, sesi ganda, route, dan journal klien. Jangan mengubah IP DHCP interface internet. Belum perlu ping router sampai router itu dipasang pada tahap berikutnya. Perubahan alamat internet dapat membuat VPN reconnect, sementara IP tunnel ditetapkan kembali oleh gateway sesuai akun.

## 8 Menambahkan MikroTik dari website dan memasang script

Sekarang buka menu Router lalu Tambah Router pada website yang sudah berjalan. MikroTik boleh berada di kota atau provider lain, asalkan mempunyai internet untuk menyambung ke gateway yang sama.

| Field | Nilai contoh untuk router pertama |
| --- | --- |
| IP sumber NAS | 10.88.0.3 sesuai akun VPN router |
| IP tujuan Disconnect | 10.88.0.3 |
| IP server RADIUS | 10.88.0.2 sesuai tunnel Ubuntu |
| Port autentikasi dan accounting | 1812 dan 1813 |
| Port Disconnect | 3799 |
| Host dan username SSTP | Gateway aktual dan vpn_router01 |
| Password SSTP | Password akun router hanya untuk script kali ini |

Shared secret RADIUS dapat dibuat acak oleh web. Sebelum menjalankan script, upload CA publik melalui Files Winbox dan impor pada MikroTik:

~~~routeros
/certificate import file-name=sstp-ca.crt passphrase=""
/certificate print
/certificate set [find where common-name="UNZANET-SSTP-CA"] trusted=yes
~~~

Nama CA di atas mengikuti installer gateway; gunakan nama aktual bila CA berbeda. Sinkronkan waktu router. Klik Simpan di web, pilih RouterOS yang sesuai pada dialog script, salin seluruh script, lalu paste di Terminal router tujuan. Script membuat SSTP, rute /32 ke RADIUS, konfigurasi RADIUS dan incoming Disconnect. Script juga membatasi koneksi TCP baru dari IP server RADIUS ke administrasi router. Internet pelanggan tetap melalui WAN semula.

Password admin MikroTik tidak dikirim ke web. Password VPN router hanya untuk respons script saat itu; shared secret RADIUS tetap disimpan karena diperlukan protokol. Script berisi secret, jadi simpan privat. Saat mengunduh ulang, tunnel yang sudah ada dipertahankan; isi ulang password bila perlu membuat tunnel kembali.

Setelah kedua tunnel terhubung, barulah uji dua arah. Pada MikroTik:

~~~routeros
/ping 10.88.0.2 src-address=10.88.0.3 count=5
~~~

Pada Ubuntu:

~~~bash
ip -4 route get 10.88.0.3
ping -c 5 10.88.0.3
~~~

Ganti contoh IP sesuai penetapan gateway. Jika ping gagal, periksa kedua sesi VPN, routing antarpeer tanpa NAT, dan firewall gateway/router. Jangan mencoba ping IP LAN MikroTik jarak jauh tanpa rute yang sesuai. Ping yang berhasil belum membuktikan autentikasi PPPoE atau Disconnect.

## 9 Penerapan client NAS dan pemisahan akses hosting

FreeRADIUS dengan read_clients=yes membaca daftar NAS ketika proses mulai. Worker root terpisah memeriksa perubahan client aktif sekitar setiap 60 detik, memvalidasi konfigurasi, lalu restart FreeRADIUS bila diperlukan. Backend web tidak diberi sudo. Restart singkat memengaruhi permintaan RADIUS baru; sesi PPPoE aktif tetap berada pada router.

~~~bash
sudo systemctl list-timers unzanet-radius-nas-refresh.timer --no-pager
sudo systemctl start unzanet-radius-nas-refresh.service
sudo systemctl status unzanet-radius-nas-refresh.service --no-pager
sudo systemctl status freeradius --no-pager -l
~~~

IP web publik atau IP DHCP Ubuntu tidak digunakan sebagai identitas NAS. RADIUS dan Disconnect memakai tunnel yang dapat dijangkau kedua sisi. Ketika aplikasi dipindahkan ke VPS, sesuaikan URL/origin web dan akses HTTPS sesuai hosting, serta sambungkan VPS itu ke gateway dengan akun Ubuntu RADIUS yang tepat. Jangan menjalankan dua mesin sekaligus memakai akun/IP tunnel yang sama. Website pada laptop sendiri tetap dapat diuji melalui forwarding NAT tanpa harus dipublikasikan.

Layanan hosting untuk backend ini harus mendukung Node.js, MySQL, FreeRADIUS, proses systemd, dan koneksi SSTP atau jalur VPN setara. Shared hosting biasa yang hanya menyediakan PHP/file statis belum tentu memenuhi kebutuhan tersebut. MikroTik tidak perlu dipindah ke jaringan fisik server. Kegagalan worker dicatat privat pada /var/lib/unzanet-radius/last-error.log.

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

Installer memasang worker NAS root. Selesaikan website pada mode web, lanjutkan npm run setupvpn, lalu isi IP tunnel server RADIUS, tujuan Disconnect dan NAS pada web; simpan lalu paste script pada router. Daftarkan pool per NAS dan pasang script pool. FreeRADIUS manual harus memakai read_clients=yes dan client_query yang hanya membaca NAS aktif. Perubahan web tidak menonaktifkan layanan API perangkat secara otomatis.

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
| Website NAT tidak terbuka | Forwarding host 8080 ke guest 80, URL browser, Apache dan firewall |
| Website hosting tidak terbuka | DNS/domain, jalur masuk hosting, Apache, HTTPS dan firewall |
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

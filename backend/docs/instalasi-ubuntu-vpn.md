# Panduan Instalasi UNZANET

## 1 Install Ubuntu di VirtualBox

1. Install Oracle VirtualBox pada Windows.
2. Download ISO Ubuntu Server 24.04 LTS.
3. Buat VM: 1 CPU, RAM 2 GB, disk dinamis 40 GB.
4. Pilih Network → Adapter 1 → NAT → Cable Connected.
5. Klik Port Forwarding di bawah Cable Connected. Pada tampilan Basic, buka Advanced dahulu. Kosongkan Guest IP dan isi aturan berikut:

| Nama | Protokol | Host IP | Host Port | Guest Port |
| --- | --- | --- | --- | --- |
| unzanet-ssh | TCP | 127.0.0.1 | 2222 | 22 |
| unzanet-web | TCP | 127.0.0.1 | 8080 | 80 |

6. Jalankan installer Ubuntu. Pilih IPv4 Automatic DHCP.
7. Buat username/password Linux. Centang Install OpenSSH Server.
8. Selesaikan instalasi, reboot, lepas ISO, lalu login di console Ubuntu.

## 2 Aktifkan SSH dan remote dari CMD

1. Jalankan di console Ubuntu:

~~~bash
sudo apt update
sudo apt install -y openssh-server curl ca-certificates
sudo systemctl enable --now ssh
sudo systemctl is-active ssh
curl -I https://github.com
~~~

2. Buka CMD Windows. Ganti USER_UBUNTU dengan username Linux:

~~~cmd
ssh -p 2222 USER_UBUNTU@127.0.0.1
~~~

3. Cocokkan identitas server. Ketik yes hanya saat SSH menampilkan pertanyaan konfirmasi, lalu masukkan password Linux.
4. Jika VM lama diganti dan muncul REMOTE HOST IDENTIFICATION HAS CHANGED, jalankan di CMD Windows lalu ulangi SSH:

~~~cmd
ssh-keygen -R [127.0.0.1]:2222
~~~
5. Jika perintah ssh tidak tersedia, install OpenSSH Client melalui Optional features Windows.

## 3 Build frontend di laptop Windows

1. Gunakan folder project Windows yang sudah ada. Simpan perubahan kode frontend ke commit terlebih dahulu.
2. Install Git for Windows dan Node.js 22 pada laptop. Tutup lalu buka kembali PowerShell.
3. Jika paket belum ada atau kode frontend berubah, jalankan di PowerShell laptop dari folder project yang sama:

~~~powershell
cd "D:\1. Kuliah\Magang\Project Magang"
node --version
git --version
tar --version
npm.cmd run preparefe
Get-Item .\releases\frontend.tar.gz
~~~

4. Pastikan Node menampilkan v22 dan build selesai dengan pesan Paket siap di-commit: releases/frontend.tar.gz.
5. Jika paket dari kode frontend yang sama sudah ada, gunakan paket tersebut tanpa build ulang.
6. Jika paket berubah, commit lalu push ke GitHub melalui aplikasi Git, atau jalankan:

~~~powershell
git add releases/frontend.tar.gz
git commit -m "Build frontend produksi"
git push
~~~

7. Pastikan releases/frontend.tar.gz terlihat di GitHub sebelum melanjutkan ke Ubuntu baru.

## 4 Siapkan aplikasi di Ubuntu baru

1. Gunakan VM baru dan database kosong.
2. Jalankan pada sesi SSH Ubuntu aplikasi, bukan VPS gateway:

~~~bash
sudo apt update
sudo apt install -y git curl ca-certificates python3
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-22.sh
sudo bash /tmp/nodesource-22.sh
sudo apt install -y nodejs
node --version
npm --version
if [ -d /var/www/Project-Magang/.git ]; then
  cd /var/www/Project-Magang
  git pull --ff-only
else
  sudo install -d -o "$USER" -g "$(id -gn)" /var/www/Project-Magang
  git clone https://github.com/Gosfist/Project-Magang.git /var/www/Project-Magang
  cd /var/www/Project-Magang
fi
ls -lh releases/frontend.tar.gz
~~~

3. Pastikan paket frontend sudah tersedia dari hasil clone. Lanjut ke tahap 5 pada sesi SSH ini.

## 5 Install aplikasi dari GitHub

1. Jalankan di sesi SSH Ubuntu aplikasi:

~~~bash
cd /var/www/Project-Magang
git pull --ff-only
python3 scripts/frontend-prebuilt.py --check
npm run install
~~~

2. Pastikan muncul Paket frontend lokal valid; build frontend di server dilewati. Jika paket hilang atau ditolak, build ulang di laptop, commit dan push paket terbaru, lalu ulangi git pull.
3. Isi pertanyaan installer:

| Pertanyaan | Isian |
| --- | --- |
| URL browser | http://127.0.0.1:8080 |
| Tahap jaringan | web |
| Email administrator | Email admin milikmu |

4. Untuk aplikasi di VPS, isi URL browser dengan IP/domain sebenarnya dan akses SSH dari provider; lewati port forwarding VirtualBox.
5. Tunggu pesan Frontend hasil build laptop terpasang dan Aplikasi siap dibuka. Jangan impor database.sql lagi.
6. Jika instalasi versi lama berhenti dengan Failed to find Auth-Type EAP section, jalankan pada SSH Ubuntu aplikasi:

~~~bash
cd /var/www/Project-Magang
git pull --ff-only
sudo python3 scripts/installer-config.py radius-modules
npm run install
~~~

7. Untuk error FreeRADIUS lain, ambil baris error tanpa membagikan konfigurasi dan secret:

~~~bash
sudo grep -nEi 'error|fail|unable|unknown|invalid|denied|cannot|not found|duplicate|parse|refused' /etc/unzanet/freeradius-check.log | tail -n 40
~~~

## 6 Siapkan gateway VPN

1. Jika gateway sudah tersedia, siapkan host, CA publik, akun/IP Ubuntu dan akun/IP MikroTik dari pengelola. Lanjut ke tahap 7.
2. Jika belum tersedia, siapkan VPS Ubuntu 24.04 dengan IP publik dan TCP 443 kosong.
3. Buka CMD Windows kedua dan remote VPS VPN. Ganti USER_GATEWAY dan HOST_GATEWAY dengan akun SSH serta IP/domain publik VPS VPN. Gunakan port SSH 22 jika belum diubah:

~~~cmd
ssh -p 22 USER_GATEWAY@HOST_GATEWAY
~~~

4. Jalankan seluruh blok berikut pada SSH VPS VPN. Ganti IP_PUBLIK_VPS dengan IP publik VPS tersebut. Clone di sini mengambil script installer VPN:

~~~bash
sudo apt update
sudo apt install -y git ca-certificates
if [ -d "$HOME/Project-Magang-Gateway/.git" ]; then
  cd ~/Project-Magang-Gateway
  git pull --ff-only
else
  git clone https://github.com/Gosfist/Project-Magang.git ~/Project-Magang-Gateway
  cd ~/Project-Magang-Gateway
fi
sudo bash install-sstp-ubuntu24.sh IP_PUBLIK_VPS
sudo systemctl is-active accel-ppp
sudo cat /root/sstp-accounts.txt
if [ "$HOME" != /root ]; then
  sudo install -m 644 -o "$USER" -g "$(id -gn)" /root/sstp-ca.crt "$HOME/sstp-ca.crt"
fi
openssl x509 -in ~/sstp-ca.crt -noout -fingerprint -sha256
~~~

5. Catat host, fingerprint CA dan dua akun dari sstp-accounts.txt secara privat: vpn_radius untuk Ubuntu aplikasi, vpn_router01 untuk MikroTik. Password VPN berbeda dari password SSH VPS.
6. Gunakan IP tunnel sesuai akun gateway. Contoh akun awal:

| Perangkat | IP tunnel |
| --- | --- |
| Gateway | 10.88.0.1 |
| Ubuntu RADIUS | 10.88.0.2 |
| MikroTik pertama | 10.88.0.3 |

## 7 Pasang CA dan VPN Ubuntu

1. Kembali ke sesi SSH Ubuntu aplikasi.
2. Pada SSH Ubuntu aplikasi, ganti USER_GATEWAY dan HOST_GATEWAY dengan akun SSH serta IP/domain publik VPS VPN. Ambil CA menggunakan port SSH 22; ganti 22 jika port SSH VPS diubah. Port 443 dipakai SSTP:

~~~bash
scp -P 22 USER_GATEWAY@HOST_GATEWAY:~/sstp-ca.crt ~/sstp-ca.crt
openssl x509 -in ~/sstp-ca.crt -noout -fingerprint -sha256
~~~

3. Cocokkan fingerprint dengan gateway/pengelola. Gunakan hanya CA publik, bukan private key.
4. Pasang CA dan jalankan setup VPN:

~~~bash
sudo install -m 644 ~/sstp-ca.crt /usr/local/share/ca-certificates/unzanet-sstp.crt
sudo update-ca-certificates
cd /var/www/Project-Magang
git pull --ff-only
npm run setupvpn
~~~

5. Isi data sesuai akun gateway:

| Pertanyaan | Isian |
| --- | --- |
| Host gateway | IP publik VPS VPN yang dipakai saat membuat sertifikat, atau domain pada sertifikat; tanpa https:// dan tanpa :443 |
| Username SSTP Ubuntu | vpn_radius atau akun Ubuntu dari gateway |
| Password SSTP Ubuntu | Password akun vpn_radius dari sstp-accounts.txt |
| IP tunnel Ubuntu | 10.88.0.2 atau IP dari gateway |
| IP tunnel MikroTik pertama | 10.88.0.3 atau IP dari gateway |
| Subnet tunnel | 10.88.0.0/24 atau subnet dari gateway |

6. Periksa tunnel. Ganti IP contoh sesuai gateway:

~~~bash
sudo systemctl is-active sstp-radius
ip -4 address show sstp-radius
ping -c 5 10.88.0.1
~~~

7. Pastikan interface UP, memiliki inet 10.88.0.2 peer 10.88.0.1, dan ping berhasil. Sesuaikan IP jika akun gateway berbeda. State UNKNOWN dapat muncul pada PPP yang sudah terhubung.
8. Jika interface belum ada atau service terus activating, periksa pada SSH Ubuntu aplikasi:

~~~bash
sudo journalctl -u sstp-radius -n 60 --no-pager
nc -vz -w 5 HOST_GATEWAY 443
~~~

9. Jika konfigurasi lama masih memakai opsi sstp-socket, perbaiki menjadi sstp-sock pada SSH Ubuntu aplikasi:

~~~bash
cd /var/www/Project-Magang
git pull --ff-only
sudo sed -i 's/^sstp-socket /sstp-sock /' /etc/ppp/peers/sstp-radius
sudo systemctl restart sstp-radius
sleep 8
ip -4 address show sstp-radius
ping -c 5 10.88.0.1
~~~

10. Lanjut setelah tunnel aktif dan ping gateway berhasil. Pertahankan DHCP interface internet Ubuntu.

## 8 Buka website dan login

1. Jalankan melalui SSH Ubuntu:

~~~bash
sudo systemctl is-active mysql apache2 freeradius unzanet-backend unzanet-botwa
curl -I http://127.0.0.1/
sudo cat /etc/unzanet/credentials.txt
~~~

2. Pastikan service active dan web merespons HTTP 200.
3. Buka http://127.0.0.1:8080 di browser Windows.
4. Login memakai email dan password dari credentials.txt. Email bawaan admin@unzanet.com; password dibuat acak saat instalasi. Ganti password melalui profil dan simpan kredensial secara privat.
5. Buat snapshot VM. Lanjut ke MikroTik setelah VPN Ubuntu dan login website berhasil.

## 9 Tambah MikroTik dan paste satu script

1. Pastikan MikroTik memiliki internet, DNS dan waktu yang benar.
2. Di SSH Ubuntu, baca CA publik:

~~~bash
cat ~/sstp-ca.crt
~~~

3. Di website, buka Router → Tambah Router. Isi data sesuai gateway:

| Field | Isian |
| --- | --- |
| Nama Router | Nama MikroTik |
| IP NAS / Sumber RADIUS | IP tunnel MikroTik, contoh 10.88.0.3 |
| IP Tujuan Disconnect | IP tunnel MikroTik, contoh 10.88.0.3 |
| IP Server FreeRADIUS | IP tunnel Ubuntu, contoh 10.88.0.2 |
| Port Auth RADIUS | 1812 |
| Port Disconnect | 3799 |
| Shared Secret RADIUS | Kosongkan untuk dibuat otomatis |
| Host Server VPN | IP/domain gateway sesuai sertifikat |
| Username dan password VPN | Akun VPN khusus MikroTik |
| Sertifikat CA VPN Publik PEM | Seluruh blok BEGIN CERTIFICATE sampai END CERTIFICATE |

4. Klik Simpan & Buat Script.
5. Pilih RouterOS 6.x atau 7.x sesuai perangkat, lalu klik Salin Script.
6. Buka Terminal Winbox router tujuan. Paste seluruh script satu kali.
7. Tunggu tunnel terhubung dan refresh NAS sekitar 60 detik.
8. Periksa pada MikroTik; ganti IP contoh sesuai gateway:

~~~routeros
/interface sstp-client print
/ping 10.88.0.2 src-address=10.88.0.3 count=5
/radius print
~~~

9. Periksa dari SSH Ubuntu:

~~~bash
ping -c 5 10.88.0.3
~~~

## 10 Siapkan PPPoE dan pool

1. Jika server PPPoE dan pool sudah tersedia, lanjut ke langkah 4.
2. Untuk router kosong, ganti PORT_PELANGGAN dan sesuaikan subnet pelanggan. Jalankan pada MikroTik:

~~~routeros
/ip pool add name=pool-pppoe ranges=192.168.75.2-192.168.75.254
/ppp profile add name=pppoe-default local-address=192.168.75.1 remote-address=pool-pppoe dns-server=1.1.1.1,8.8.8.8
/interface pppoe-server server add interface=PORT_PELANGGAN service-name=PPPoE-UNZANET default-profile=pppoe-default authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no
~~~

3. Jika belum ada NAT pelanggan, ganti PORT_WAN lalu jalankan:

~~~routeros
/ip firewall nat add chain=srcnat src-address=192.168.75.0/24 out-interface=PORT_WAN action=masquerade comment="NAT pelanggan PPPoE"
~~~

4. Daftarkan nama/rentang pool pada menu IP Pool di web dan pilih NAS yang tepat.
5. Simpan, lalu pasang script pool yang dihasilkan pada MikroTik.
6. Buat Harga Paket dan pilih nama pool yang sama.

## 11 Uji pelanggan dan Disconnect

1. Buat akun pelanggan uji di web dengan NAS dan paket yang benar.
2. Jangan buat PPP secret lokal dengan username yang sama pada MikroTik.
3. Dial PPPoE dari perangkat pelanggan.
4. Periksa IP pelanggan, akses internet dan batas kecepatan.
5. Periksa pada MikroTik:

~~~routeros
/ppp active print
/radius monitor [find where service=ppp]
~~~

6. Periksa accounting melalui SSH Ubuntu:

~~~bash
sudo mysql unzanet -e "SELECT username,nasipaddress,framedipaddress,acctstarttime,acctupdatetime,acctstoptime FROM radacct ORDER BY radacctid DESC LIMIT 5;"
~~~

7. Klik Putus Sesi pada pelanggan uji di web.
8. Pastikan sesi terputus dan pelanggan aktif dapat reconnect.

## 12 Aktifkan dan uji isolir

1. Buka Isolir PPPoE pada web dan pilih NAS.
2. Isi pool isolir terpisah, contoh rentang 192.168.100.2–192.168.100.254, subnet 192.168.100.0/24 dan gateway 192.168.100.1.
3. Buat script isolir, paste pada MikroTik tujuan, lalu periksa pool/profil/firewall.
4. Konfirmasi pemasangan script pada web.
5. Isolir pelanggan uji. Pastikan reconnect ke pool isolir dan akses internet terblokir.
6. Uji ACC pembayaran atau janji bayar. Pastikan reconnect ke pool normal dan internet kembali.

## 13 Selesaikan pengaturan

1. Isi area, petugas, biaya, paket dan data operasional.
2. Buka Login Bot Wa dan scan QR dengan ponsel.
3. Backup database, uploads dan secret installer secara privat.
4. Untuk hosting, pasang domain/HTTPS dan sesuaikan URL/origin web.
5. Jika integrasi lain tidak memakai API MikroTik, nonaktifkan pada Terminal router:

~~~routeros
/ip service set [find where name="api"] disabled=yes
/ip service set [find where name="api-ssl"] disabled=yes
~~~

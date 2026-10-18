# Panduan Instalasi UNZANET

## 1 Install Ubuntu di VirtualBox

1. Install Oracle VirtualBox pada Windows.
2. Download ISO Ubuntu Server 24.04 LTS.
3. Buat VM: 2 CPU, RAM 4 GB, disk dinamis 40 GB.
4. Pilih Network → Adapter 1 → NAT → Cable Connected.
5. Buka Advanced → Port Forwarding. Kosongkan Guest IP dan isi aturan berikut:

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

3. Cocokkan identitas server, ketik yes, lalu masukkan password Linux.
4. Jalankan tahap berikutnya pada sesi SSH Ubuntu ini.
5. Jika perintah ssh tidak tersedia, install OpenSSH Client melalui Optional features Windows.

## 3 Install aplikasi

1. Gunakan VM baru dan database kosong. Pastikan revisi terbaru sudah tersedia di Git remote.
2. Jalankan melalui SSH Ubuntu:

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

3. Isi pertanyaan installer:

| Pertanyaan | Isian |
| --- | --- |
| URL browser | http://127.0.0.1:8080 |
| Tahap jaringan | web |
| Email administrator | Email admin milikmu |

4. Tunggu installer selesai tanpa error. Jangan impor database.sql lagi.
5. Untuk VPS, gunakan IP/domain web dan akses SSH dari provider; lewati port forwarding VirtualBox.

## 4 Siapkan gateway VPN

1. Jika gateway sudah tersedia, siapkan host, CA publik, akun/IP Ubuntu dan akun/IP MikroTik dari pengelola. Lanjut ke tahap 5.
2. Jika belum tersedia, siapkan VPS Ubuntu 24.04 dengan IP publik dan TCP 443 kosong.
3. Buka CMD Windows kedua dan remote VPS gateway:

~~~cmd
ssh USER_GATEWAY@HOST_GATEWAY
~~~

4. Ganti IP_PUBLIK_VPS, lalu jalankan pada VPS gateway:

~~~bash
sudo apt update
sudo apt install -y git ca-certificates
git clone https://github.com/Gosfist/Project-Magang.git ~/Project-Magang-Gateway
cd ~/Project-Magang-Gateway
sudo bash install-sstp-ubuntu24.sh IP_PUBLIK_VPS
sudo systemctl is-active accel-ppp
sudo cat /root/sstp-accounts.txt
if [ "$HOME" != /root ]; then
  sudo install -m 644 -o "$USER" -g "$(id -gn)" /root/sstp-ca.crt "$HOME/sstp-ca.crt"
fi
openssl x509 -in ~/sstp-ca.crt -noout -fingerprint -sha256
~~~

5. Catat host, fingerprint CA, username/password Ubuntu dan username/password MikroTik secara privat.
6. Gunakan IP tunnel sesuai akun gateway. Contoh akun awal:

| Perangkat | IP tunnel |
| --- | --- |
| Gateway | 10.88.0.1 |
| Ubuntu RADIUS | 10.88.0.2 |
| MikroTik pertama | 10.88.0.3 |

## 5 Pasang CA dan VPN Ubuntu

1. Kembali ke sesi SSH Ubuntu aplikasi.
2. Ganti PORT_SSH_GATEWAY, USER_GATEWAY dan HOST_GATEWAY, lalu ambil CA publik:

~~~bash
scp -P PORT_SSH_GATEWAY USER_GATEWAY@HOST_GATEWAY:~/sstp-ca.crt ~/sstp-ca.crt
openssl x509 -in ~/sstp-ca.crt -noout -fingerprint -sha256
~~~

3. Cocokkan fingerprint dengan gateway/pengelola. Gunakan hanya CA publik, bukan private key.
4. Pasang CA dan jalankan setup VPN:

~~~bash
sudo install -m 644 ~/sstp-ca.crt /usr/local/share/ca-certificates/unzanet-sstp.crt
sudo update-ca-certificates
cd /var/www/Project-Magang
npm run setupvpn
~~~

5. Isi data sesuai akun gateway:

| Pertanyaan | Isian |
| --- | --- |
| Host gateway | IP/domain sesuai sertifikat gateway |
| Username dan password SSTP Ubuntu | Akun VPN khusus Ubuntu |
| IP tunnel Ubuntu | 10.88.0.2 atau IP dari gateway |
| IP tunnel MikroTik pertama | 10.88.0.3 atau IP dari gateway |
| Subnet tunnel | 10.88.0.0/24 atau subnet dari gateway |

6. Periksa tunnel. Ganti IP contoh sesuai gateway:

~~~bash
sudo systemctl is-active sstp-radius
ip -4 address show sstp-radius
ping -c 5 10.88.0.1
~~~

7. Lanjut setelah tunnel aktif dan ping gateway berhasil. Pertahankan DHCP interface internet Ubuntu.

## 6 Buka website dan login

1. Jalankan melalui SSH Ubuntu:

~~~bash
sudo systemctl is-active mysql apache2 freeradius unzanet-backend unzanet-botwa
curl -I http://127.0.0.1/
sudo cat /etc/unzanet/credentials.txt
~~~

2. Pastikan service active dan web merespons HTTP 200.
3. Buka http://127.0.0.1:8080 di browser Windows.
4. Login dengan kredensial awal. Ganti password melalui profil.
5. Buat snapshot VM. Lanjut ke MikroTik setelah VPN Ubuntu dan login website berhasil.

## 7 Tambah MikroTik dan paste satu script

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

## 8 Siapkan PPPoE dan pool

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

## 9 Uji pelanggan dan Disconnect

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

## 10 Aktifkan dan uji isolir

1. Buka Isolir PPPoE pada web dan pilih NAS.
2. Isi pool isolir terpisah, contoh rentang 192.168.100.2–192.168.100.254, subnet 192.168.100.0/24 dan gateway 192.168.100.1.
3. Buat script isolir, paste pada MikroTik tujuan, lalu periksa pool/profil/firewall.
4. Konfirmasi pemasangan script pada web.
5. Isolir pelanggan uji. Pastikan reconnect ke pool isolir dan akses internet terblokir.
6. Uji ACC pembayaran atau janji bayar. Pastikan reconnect ke pool normal dan internet kembali.

## 11 Selesaikan pengaturan

1. Isi area, petugas, biaya, paket dan data operasional.
2. Buka Login Bot Wa dan scan QR dengan ponsel.
3. Backup database, uploads dan secret installer secara privat.
4. Untuk hosting, pasang domain/HTTPS dan sesuaikan URL/origin web.
5. Jika integrasi lain tidak memakai API MikroTik, nonaktifkan pada Terminal router:

~~~routeros
/ip service set [find where name="api"] disabled=yes
/ip service set [find where name="api-ssl"] disabled=yes
~~~

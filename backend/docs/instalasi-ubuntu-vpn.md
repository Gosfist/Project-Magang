# Panduan Instalasi UNZANET di VPS

## 1 Siapkan VPS dan domain

1. Gunakan VPS Ubuntu Server 24.04 LTS baru dengan akses sudo, IPv4 publik, dan dukungan PPP kernel. Website, database, FreeRADIUS, dan server SSTP dipasang pada VPS yang sama.
2. Arahkan DNS A domain website ke IPv4 publik VPS. Ganti IP_VPS dan DOMAIN_WEBSITE pada langkah berikut dengan alamat Anda.
3. Buka firewall provider: SSH TCP 22, HTTP TCP 80, HTTPS TCP 443, dan SSTP TCP 4443. UDP RADIUS 1812/1813 dan database tidak perlu dibuka ke internet.
4. Pastikan subnet 10.88.0.0/24 belum digunakan pada VPS maupun MikroTik. Server RADIUS memakai 10.88.0.1; router mendapat IP unik 10.88.0.2 sampai 10.88.0.254.
5. Buka CMD Windows:

~~~cmd
ssh USER_VPS@IP_VPS
~~~

6. Cocokkan fingerprint SSH melalui console provider sebelum menerima host baru. Password SSH adalah password Linux VPS, berbeda dari akun VPN.

## 2 Siapkan frontend di Windows

1. Gunakan folder project Windows yang sudah ada dan Node.js 22. Simpan perubahan kode frontend ke commit dahulu.
2. Jika frontend berubah atau paket belum tersedia, jalankan pada PowerShell Windows:

~~~powershell
cd "D:\1. Kuliah\Magang\Project Magang"
npm.cmd run preparefe
Get-Item .\releases\frontend.tar.gz
~~~

3. Commit dan push kode beserta releases/frontend.tar.gz ke GitHub. Server mengambil paket yang sama melalui clone/pull; Angular dibangun pada laptop.

## 3 Install aplikasi pada VPS

1. Jalankan pada SSH VPS:

~~~bash
sudo apt update
sudo apt install -y git curl ca-certificates python3
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource22.sh
sudo bash /tmp/nodesource22.sh
sudo apt install -y nodejs
node --version
~~~

2. Jika folder project belum ada, clone sekali:

~~~bash
sudo install -d -o "$USER" -g "$(id -gn)" /var/www/Project-Magang
git clone https://github.com/Gosfist/Project-Magang.git /var/www/Project-Magang
cd /var/www/Project-Magang
~~~

3. Jika folder sudah berisi repo, gunakan langkah ini tanpa clone ulang:

~~~bash
cd /var/www/Project-Magang
git status --short
git pull --ff-only
~~~

4. Simpan perubahan lokal sebelum pull. Jangan menghapus folder/database untuk mengatasi konflik.
5. Periksa paket lalu jalankan installer dari root project:

~~~bash
python3 scripts/frontend-prebuilt.py --check
npm run install
~~~

| Isian installer | Nilai |
| --- | --- |
| URL browser | https://DOMAIN_WEBSITE |
| Tahap jaringan | web |
| Email administrator | Email administrator Anda |

6. Tunggu aplikasi siap. Gunakan VPS/database baru; database.sql hanya diimpor pada database kosong. Update kode tidak memigrasikan skema database lama.

## 4 Aktifkan HTTPS website

1. Pastikan DNS domain mengarah ke VPS. Jalankan pada SSH VPS:

~~~bash
sudo apt install -y certbot python3-certbot-apache
sudo ufw allow 443/tcp
sudo certbot --apache -d DOMAIN_WEBSITE --redirect
sudo apache2ctl configtest
sudo certbot renew --dry-run
~~~

2. Ikuti isian email dan persetujuan Certbot. Buka https://DOMAIN_WEBSITE dan pastikan sertifikat valid sebelum login. Website memakai 80/443; SSTP memakai 4443 pada IP VPS yang sama.

## 5 Pasang server VPN pada VPS yang sama

1. Jalankan pada SSH VPS dari root project:

~~~bash
cd /var/www/Project-Magang
npm run setupvpnserver
~~~

2. Isi IPv4 publik VPS tanpa https, garis miring, atau port. Installer membuat CA, sertifikat SSTP, gateway 10.88.0.1, firewall, dan worker akun.
3. Periksa:

~~~bash
sudo systemctl is-active accel-ppp
sudo systemctl is-active unzanet-vpn-sync.timer
sudo systemctl is-active unzanet-vpn-ping
ip -4 address show dev lo
sudo ss -ltnp 'sport = :4443'
sudo freeradius -XC
~~~

4. Pastikan 10.88.0.1/32 terpasang pada lo dan TCP 4443 mendengarkan. Tidak perlu akun VPN Ubuntu atau menjalankan npm run setupvpn.
5. CA publik di /etc/unzanet-public/sstp-ca.crt dipakai otomatis oleh website. Private key tetap pada VPS.

## 6 Login dan buat klien VPN

1. Baca login administrator awal melalui SSH VPS:

~~~bash
sudo cat /etc/unzanet/credentials.txt
~~~

2. Login pada https://DOMAIN_WEBSITE. Ganti password administrator melalui profil.
3. Buka Router > Klien VPN > Tambah VPN.

| Isian | Contoh |
| --- | --- |
| Nama | Router Cabang 1 |
| Username | vpn_router01 |
| Password | Kosongkan untuk password acak atau isi minimal 12 karakter |

4. Klik Buat Akun VPN. Tunggu sekitar 15 detik sampai status Siap; daftar diperbarui otomatis selama ada akun menunggu. Gunakan Muat Ulang bila perlu.
5. Daftar menampilkan No, Nama, Username, Password dengan tombol Tampilkan, IP VPN, Status, dan Router / NAS.
6. Siap berarti akun sudah diterapkan ke server SSTP, belum berarti tunnel online. Buat satu akun berbeda untuk setiap router.

## 7 Tambah Router NAS dari klien VPN

1. Buka Router > Router / NAS > Tambah Router NAS. Pilih klien VPN yang Siap dan belum dipakai router lain.

| Isian | Nilai |
| --- | --- |
| Nama Router | MikroTik Cabang 1 |
| Tipe Router | MikroTik Router |
| Klien VPN | vpn_router01 dan IP yang tampil |
| IP NAS dan Disconnect | Otomatis dari klien VPN |
| IP Server RADIUS | Otomatis 10.88.0.1 |
| Port autentikasi dan Disconnect | 1812 dan 3799 |
| Shared secret | Kosongkan untuk nilai acak |

2. Klik Simpan & Buat Script. Pilih versi RouterOS 6/7 sesuai perangkat, lalu salin script.
3. Buka Winbox > New Terminal pada MikroTik tujuan. Paste script sekali. Script mengimpor CA, membuat SSTP port 4443, rute /32 ke RADIUS, PPP AAA, accounting, incoming Disconnect, dan firewall.
4. Username/password/CA otomatis berasal dari klien terpilih. Tombol Script dapat membuat ulang script lengkap tanpa mengetik password lagi.
5. Tunggu penerapan NAS ke FreeRADIUS sekitar 60 detik. Simpan NAS belum membuktikan script sudah dipasang pada MikroTik.

## 8 Periksa tunnel dan uji PPPoE

1. Jalankan pada Terminal MikroTik:

~~~routeros
/interface sstp-client print detail
/ping 10.88.0.1 count=5
/radius print detail
/radius incoming print
/ppp aaa print
~~~

2. Pastikan tunnel running, port 4443, sertifikat terverifikasi, use-radius=yes, accounting aktif, dan incoming Disconnect port 3799.
3. Pada SSH VPS, ganti IP_KLIEN_VPN dengan IP dari daftar:

~~~bash
sudo accel-cmd show sessions
ping -c 5 IP_KLIEN_VPN
ip route get IP_KLIEN_VPN
sudo systemctl status unzanet-radius-nas-refresh.timer --no-pager
~~~

4. Cocokkan username/IP sesi dengan klien yang dipilih pada NAS. Rute VPS harus menuju interface SSTP router tersebut.
5. Siapkan PPPoE Server pada interface pelanggan yang benar dan profil PPP dengan local-address valid. Daftarkan IP Pool serta Harga Paket di website dan pasang script pool pada router yang sama.
6. Buat/aktifkan akun pelanggan dengan NAS tersebut. Dial dari perangkat pelanggan memakai username/password PPPoE, terpisah dari akun VPN router.

~~~routeros
/ppp active print
/log print where topics~"radius|ppp|sstp"
~~~

7. Periksa Monitoring RADIUS dan accounting Start/Interim. Uji Putus Sesi, isolir, serta pemulihan; pastikan sesi nyata terputus/tersambung dan menerima pool/profil yang sesuai.
8. Buka Login Bot Wa lalu pindai QR menggunakan ponsel jika memakai Bot WhatsApp.

## 9 Pemulihan dan perawatan

1. Jika akun terus Menunggu server, jalankan pada SSH VPS:

~~~bash
sudo systemctl status unzanet-vpn-sync.service --no-pager
sudo systemctl start unzanet-vpn-sync.service
sudo cat /var/lib/unzanet-vpn/last-error
~~~

2. Jika last-error tidak ada, baca status service dan muat ulang daftar. Periksa kecocokan skema database dan secret instalasi. Jangan mengganti JWT_SECRET untuk mencoba memperbaiki dekripsi password.
3. Jika SSTP gagal, periksa:

~~~bash
sudo journalctl -u accel-ppp -n 80 --no-pager
sudo tail -n 80 /var/log/accel-ppp/auth-fail.log
sudo ufw status numbered
sudo ss -ltnp 'sport = :4443'
~~~

4. Cocokkan IP publik, username/password VPN, jam router, CA, serta firewall provider TCP 4443. Jangan membagikan private key atau screenshot kredensial.
5. Jika EAP FreeRADIUS gagal saat install, jalankan git pull --ff-only lalu npm run install kembali. Installer menonaktifkan modul EAP bawaan yang tidak dipakai, tanpa menghapus database.
6. Jika setup VPN terhenti setelah konfigurasi dibuat, periksa error dahulu. Pasang ulang worker tanpa menimpa sertifikat/akun:

~~~bash
cd /var/www/Project-Magang
sudo bash scripts/setup-vpn-sync.sh
sudo systemctl restart unzanet-vpn-ping accel-ppp unzanet-backend
~~~

7. Sertifikat SSTP berlaku 365 hari. Periksa tanggal sebelum kedaluwarsa:

~~~bash
sudo openssl x509 -in /etc/sstp-vpn/server.crt -noout -dates
~~~

8. Perbarui dengan CA yang sama pada SSH VPS. IP publik harus masih sesuai server.ext:

~~~bash
sudo openssl x509 -req -in /etc/sstp-vpn/server.csr \
  -CA /etc/sstp-vpn/ca.crt -CAkey /etc/sstp-vpn/ca.key \
  -CAcreateserial -out /etc/sstp-vpn/server.crt \
  -days 365 -sha256 -extfile /etc/sstp-vpn/server.ext
sudo sh -c 'cat /etc/sstp-vpn/server.crt /etc/sstp-vpn/ca.crt > /etc/sstp-vpn/server-chain.pem'
sudo systemctl restart accel-ppp
~~~

9. Restart SSTP menyambung ulang tunnel router. Jadwalkan perawatan dan periksa sesi/accounting sesudahnya. HTTPS website diperbarui terpisah melalui Certbot.
10. Backup database, uploads, secret instalasi, dan CA/private key secara privat. npm run update hanya memperbarui kode, tanpa memigrasikan database lama.

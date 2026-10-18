# PT UNZANET

Aplikasi PT UNZANET telah dimigrasikan penuh dari Laravel/Blade ke TypeScript dengan dua proyek:

- `frontend`: Angular 19, TypeScript, Tailwind CSS.
- `backend`: NestJS 12, TypeScript, Prisma ORM, MySQL.

Fitur yang dipertahankan: web profile, login JWT, dashboard, role admin/petugas, data petugas, Main Core (Server, Rasio, ODC, ODP), Trace Jalur, kalkulator redaman, paket PPPoE, akun PPPoE, dan sinkronisasi FreeRADIUS.

## Instalasi Ubuntu baru

Panduan instalasi utama adalah [`install.doc`](install.doc), dengan [sumber teks yang sama](backend/docs/instalasi-ubuntu-vpn.md). Urutannya: pasang Ubuntu VirtualBox dengan DHCP/NAT, aktifkan SSH dan remote dari CMD Windows, build frontend di laptop dengan `npm.cmd run preparefe`, clone repo di Ubuntu dan upload paket frontend, jalankan `npm run install`, sambungkan VPN Ubuntu dengan `npm run setupvpn`, buka website dan uji login, kemudian tambah NAS untuk membuat satu script VPN/RADIUS MikroTik. VirtualBox meneruskan host `127.0.0.1:2222` ke guest SSH port 22 serta host `127.0.0.1:8080` ke guest Apache port 80. Internet boleh dari Wi-Fi, hotspot, atau provider; Ubuntu dan MikroTik tidak perlu satu LAN. Pada VPS gunakan jaringan provider. Installer ditujukan untuk Ubuntu Server 24.04 LTS baru, repo di `/var/www/Project-Magang`, Node.js 22, internet, dan user sudo.

Setelah repo di-clone dan Node.js/npm tersedia, jalankan dari root project:

```bash
npm run install
```

Installer melakukan `git pull --ff-only`, memvalidasi paket frontend dari laptop, memasang paket Ubuntu/dependency backend dan bot, mengimpor `database.sql` hanya ketika database kosong, membuat administrator dengan password acak, membangun backend, memasang frontend siap pakai, menyiapkan Apache, MySQL, FreeRADIUS SQL, firewall, serta service systemd. Pilih mode default `web` dan isi URL browser (`http://127.0.0.1:8080` untuk NAT laptop atau alamat sebenarnya untuk VPS). Tahap ini tidak meminta akun VPN atau membutuhkan MikroTik. Konfigurasi serta secret disimpan privat di `/etc/unzanet/install.json`; password administrator awal tersedia melalui `sudo cat /etc/unzanet/credentials.txt`. Installer tidak membuat akun demo dari seed.

Setelah instalasi selesai, siapkan gateway SSTP dan CA tepercaya, lalu jalankan `npm run setupvpn` pada sesi SSH Ubuntu aplikasi. Perintah ini menyiapkan tunnel tanpa menginstal ulang website/database atau mengganti secret aplikasi. Setelah VPN Ubuntu berhasil, buka website dan uji login. Kemudian isi Tambah Router/NAS beserta akun VPN router dan satu CA publik PEM, klik Simpan & Buat Script, dan paste script sekali ke Terminal MikroTik. Script mengimpor CA, membuat SSTP, rute RADIUS, PPP AAA, incoming Disconnect, dan firewall terkait. Password VPN router serta CA dari form tidak disimpan dalam tabel NAS; shared secret RADIUS tetap diperlukan/disimpan. Akun gateway disiapkan pengelola terlebih dahulu. Alamat privat tunnel tetap sesuai gateway; IP internet/DHCP Ubuntu tidak diubah. Setelah router terhubung, uji ping, PPPoE, dan Disconnect. Mode `vpn` saat instalasi tersedia jika gateway sudah siap; `local` hanya alternatif lab LAN. Autentikasi menggunakan UDP 1812, accounting UDP 1813, dan Disconnect UDP 3799 (RFC 5176, pengganti RFC 3576). Tidak ada login API MikroTik, kredensial admin router, SNMP, atau monitoring CPU/RAM/interface router.

FreeRADIUS membaca client SQL saat startup. Worker root terpisah memvalidasi lalu menerapkan perubahan client aktif sekitar setiap 60 detik; backend web tidak diberi sudo. Status sesi bersumber dari accounting dengan batas kesegaran awal 900 detik. IP Pool berupa metadata per NAS dan script, sedangkan isolir diaktifkan setelah operator mengonfirmasi script pool/profil/firewall dipasang. QR WhatsApp tetap dipindai manual. Script tidak menebak port WAN, port pelanggan, profil dasar, atau konfigurasi PPPoE awal.

Menjalankan installer kembali mempertahankan secret dan database yang sudah ditandai. Database berisi tabel tanpa penanda installer, atau perubahan SQL terhadap instalasi berisi data, membuat installer berhenti agar tidak menimpa data. `npm run update` tetap untuk pembaruan kode setelah instalasi.
Jika `git pull` di dalam installer mengambil commit baru, installer melepas lock dan menjalankan ulang script terbaru sebelum pemasangan paket/database. Untuk mengganti installer lama yang sudah terlanjur berjalan, jalankan `git pull --ff-only` secara terpisah sebelum `npm run install`.

Frontend wajib dibangun di laptop dan diunggah sebagai `releases/frontend.tar.gz` sebelum instalasi atau update frontend. Paket yang hilang, rusak atau berbeda kode membuat proses berhenti sebelum pemasangan dependency aplikasi. Ubuntu hanya memasang dependency backend/bot, menghasilkan Prisma Client, membangun backend dan menyalin aset frontend. Tidak ada pengaturan batas RAM/CPU/worker tambahan atau penghentian MySQL, Apache dan FreeRADIUS untuk tahap build. Service aplikasi diaktifkan/direstart pada akhir instalasi. `npm run buildfe` adalah alias `npm run preparefe` untuk membuat paket di laptop.

Frontend production memakai `/api/wa` melalui proxy Apache sehingga port bot 3002 tidak perlu dibuka ke jaringan. Instalasi lama yang memperbarui frontend perlu menambahkan proxy `/api/wa` sebelum proxy `/api/`; contoh konfigurasi tersedia pada renderer installer. Perintah `npm install` di root juga memanggil lifecycle `install`; gunakan root project ini untuk installer Ubuntu, dan jalankan pengelolaan dependency per aplikasi dari subfolder masing-masing.

## Build frontend di laptop, pasang di VPS/VirtualBox

1. Pasang Node.js 22 dan Git di laptop. Simpan perubahan frontend ke commit dan push kode ke GitHub.
2. Di PowerShell laptop, dari root project:

```powershell
npm.cmd run preparefe
```

3. Di SSH Ubuntu aplikasi, siapkan folder paket (ganti `USER_UBUNTU` dengan username SSH):

```bash
sudo install -d -m 755 -o USER_UBUNTU /var/www/Project-Magang/releases
```

4. Di PowerShell laptop, unggah paket ke VirtualBox NAT:

```powershell
scp -P 2222 .\releases\frontend.tar.gz USER_UBUNTU@127.0.0.1:/var/www/Project-Magang/releases/frontend-upload.tar.gz
```

   Untuk VPS (ganti `IP_VPS` dan username):

```powershell
scp .\releases\frontend.tar.gz USER_UBUNTU@IP_VPS:/var/www/Project-Magang/releases/frontend-upload.tar.gz
```

5. Setelah upload selesai, di SSH Ubuntu aplikasi:

```bash
cd /var/www/Project-Magang
mv releases/frontend-upload.tar.gz releases/frontend.tar.gz
git pull --ff-only
npm run install
```

6. Untuk update frontend pada server yang sudah terpasang, ulangi build/upload lalu jalankan `npm run updatefe` sebagai pengganti `npm run install`.

`preparefe` memasang dependency dan melakukan build **production** di laptop, kemudian membuat satu paket `releases/frontend.tar.gz`. Folder `releases` tidak di-commit ke Git. Server memeriksa kesamaan kode frontend dan checksum semua file, lalu memasang aset tanpa dependency atau build Angular. Backend/Prisma, database dan layanan lain tetap disiapkan di Ubuntu. Alamat API production tetap `/api`, sehingga paket tidak terikat IP laptop. Paket wajib tersedia; jika hilang, rusak atau tidak sesuai kode, build ulang dan unggah paket terbaru. File chunk lama dipertahankan saat update, dan `index.html` diganti terakhir. Jangan upload saat installer/update masih berjalan.

## Menjalankan lokal

Gunakan tiga terminal.

```powershell
cd frontend
npm install
npm start
```

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run start:dev
```

```powershell
cd bot_whatsapp
Copy-Item .env.example .env
npm install
npm start
```

Frontend tersedia di `http://localhost:3000`, REST API di `http://localhost:3001/api`, dan Bot WhatsApp di `http://localhost:3002/api/wa`.

`BOT_API_KEY` pada `backend/.env` dan `bot_whatsapp/.env` harus sama persis. Jika berbeda, backend akan mendapat respons `401 API key tidak valid` saat mengirim notifikasi WhatsApp.

## Database

File SQL untuk **instalasi baru** adalah [`backend/prisma/database.sql`](backend/prisma/database.sql). Semua perubahan tanpa API MikroTik sudah langsung berada di file ini, termasuk metadata NAS, Disconnect, pool per NAS, dan pengaturan awal. Gunakan database kosong pada VM VirtualBox baru. Tidak ada file migrasi terpisah.

Setelah membuat database kosong dan mengisi `backend/.env`, jalankan:

```powershell
cd backend
npx prisma db execute --file prisma/database.sql --schema prisma/schema.prisma
npm run prisma:generate
npm run db:seed
```

Alternatif: pilih database kosong di phpMyAdmin lalu impor `backend/prisma/database.sql`. Pembuatan akun awal tetap menggunakan `npm run db:seed` dari folder `backend`.

`npm run update` / `npm run updatebe` memperbarui kode, build, dan service. Keduanya tidak mengubah skema atau mengimpor ulang `database.sql`. Untuk setup yang diminta, gunakan VM baru atau snapshot kosong lalu jalankan installer; database berisi data tidak direset otomatis.

Setiap skema Prisma berubah, perbarui file SQL lengkap dari root project:

```powershell
npm run database:generate
npm run database:check
```

Kedua perintah tersebut menghasilkan/memeriksa file SQL tanpa menghubungi database. Tabel VPN legacy masih ada untuk kompatibilitas; fitur Klien VPN di aplikasi sudah dihapus.

Akun seed pengembangan:

- Admin: `admin@unzanet.com` / `123`
- Teknisi: `teknisi@unzanet.com` / `password`

Jika data akun PPPoE berasal dari Laravel, salin nilai `APP_KEY` lama ke `LARAVEL_APP_KEY` agar backend NestJS dapat mendekripsi password lama dan menyinkronkannya ke FreeRADIUS. Satu akun selalu dibatasi satu sesi melalui `Simultaneous-Use := 1`.

Dokumentasi PPPoE/FreeRADIUS berada di `backend/docs`.

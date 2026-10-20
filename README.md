# PT UNZANET

Aplikasi PT UNZANET telah dimigrasikan penuh dari Laravel/Blade ke TypeScript dengan dua proyek:

- `frontend`: Angular 19, TypeScript, Tailwind CSS.
- `backend`: NestJS 12, TypeScript, Prisma ORM, MySQL.

Fitur yang dipertahankan: web profile, login JWT, dashboard, role admin/petugas, data petugas, Main Core (Server, Rasio, ODC, ODP), Trace Jalur, kalkulator redaman, paket PPPoE, akun PPPoE, dan sinkronisasi FreeRADIUS.

## Instalasi Ubuntu baru

Panduan utama adalah [`install.doc`](install.doc), dengan [sumber yang sama](backend/docs/instalasi-ubuntu-vpn.md). Website, MySQL, FreeRADIUS, dan server SSTP berjalan langsung pada satu VPS Ubuntu Server 24.04 LTS. Website memakai 80/443; SSTP memakai TCP 4443. Tidak memerlukan VirtualBox atau layanan VPN berbayar.

Build frontend di laptop, commit/push kode beserta `releases/frontend.tar.gz`, lalu clone/pull pada VPS. Jalankan dari root project:

```bash
npm run install
```

Satu perintah ini memasang aplikasi, HTTPS Certbot beserta timer pembaruan, dan SSTP beserta CA/sertifikat dan worker akun pada VPS yang sama. Isi domain/URL website, IPv4 publik VPS tanpa URL/port, dan email aktif untuk sertifikat. Domain otomatis memakai HTTPS; URL berupa IP saja memakai HTTP. Untuk Cloudflare, gunakan DNS only saat instalasi, lalu Proxied + Full (strict) setelah HTTPS berhasil. IP server RADIUS/gateway `10.88.0.1`, klien router mendapat IP unik `10.88.0.2-254`. Pastikan subnet belum dipakai. Firewall provider membuka TCP 22, 80, 443, 4443; UDP RADIUS hanya melalui tunnel. Tidak perlu menjalankan `npm run setupvpnserver` terpisah, `npm run setupvpn`, atau membuat akun VPN Ubuntu sendiri.

Administrator membuka **Router > Klien VPN > Tambah VPN**. Isi nama/username; password boleh acak atau manual minimal 12 karakter. Daftar menampilkan No, Nama, Username, Password langsung, IP VPN, Router/NAS, dan ikon Edit/Hapus; tidak ada kolom Status atau tombol tampil/sembunyi. Edit dapat mengganti nama, username dan password; IP VPN tetap. Password disimpan terenkripsi, ditampilkan melalui daftar kredensial khusus admin dengan `private, no-store`; daftar pilihan NAS tetap tanpa password. Worker root menerapkan akun sekitar 15 detik tanpa sudo pada backend. Setelah username/password diubah, ubah User/Password pada interface SSTP yang sudah ada melalui Winbox; jangan paste ulang script add. Akun yang masih terhubung ke NAS harus dilepas/diganti pada NAS dahulu sebelum dihapus.

Pada **Router / NAS**, pilih klien yang sudah dapat dipilih; opsi Menunggu server belum dapat digunakan. Satu klien hanya untuk satu router, ditegakkan juga oleh database. IP NAS/Disconnect dan RADIUS diisi dari akun; username/password/CA otomatis dipakai pada script. Klik Simpan & Buat Script dan salin ke Terminal Winbox. Script dapat diambil ulang lengkap tanpa mengetik kredensial. CA/hostname tetap diverifikasi, rute hanya /32 ke RADIUS, default route pelanggan tetap. Uji tunnel, PPPoE, accounting, Disconnect, serta isolir sesuai panduan.

Installer menyiapkan dependency, database baru, administrator awal otomatis `admin@unzanet.com` dengan password `123`, backend, frontend siap pakai, Apache, MySQL, FreeRADIUS SQL, firewall dan systemd. Email/password administrator awal tidak ditanyakan dan tidak dibuat acak. Email sertifikat adalah kontak aktif Anda dan berbeda dari login administrator. Saat instalasi diulang, akun yang sudah ada tetap dipertahankan; password yang sudah diganti melalui web tidak direset. Secret aplikasi tetap acak dan disimpan di `/etc/unzanet/install.json` (root-only); login awal juga dicatat di `/etc/unzanet/credentials.txt` (root-only). Konfigurasi gabungan ditanyakan sekali, termasuk saat melengkapi instalasi web lama. Mengulang installer mempertahankan CA, private key dan akun VPN terkelola; konfigurasi SSTP asing atau perubahan IP sertifikat membuat proses berhenti. Sertifikat SSTP berlaku 365 hari; langkah pembaruan dengan CA yang sama ada di panduan. Alias `setupvpnserver` tetap tersedia untuk perawatan.

FreeRADIUS membaca client SQL saat startup. Worker root terpisah memvalidasi lalu menerapkan perubahan client aktif sekitar setiap 60 detik; backend web tidak diberi sudo. Status sesi bersumber dari accounting dengan batas kesegaran awal 900 detik. Prefix pool Internet/Isolir diatur pada Tambah/Edit Router NAS dan langsung disimpan untuk RADIUS tanpa konfirmasi pemasangan. Salin script pool/profil/firewall ke MikroTik; Harga Paket mengatur harga dan kecepatan. QR WhatsApp tetap dipindai manual. Operator tetap menentukan interface WAN/pelanggan dan PPPoE Server; profil gateway dibuat script NAS.

Menjalankan installer kembali mempertahankan secret dan database yang sudah ditandai. Database berisi tabel tanpa penanda installer, atau perubahan SQL terhadap instalasi berisi data, membuat installer berhenti agar tidak menimpa data. `npm run update` tetap untuk pembaruan kode setelah instalasi.
Jika `git pull` di dalam installer mengambil commit baru, installer melepas lock dan menjalankan ulang script terbaru sebelum pemasangan paket/database. Untuk mengganti installer lama yang sudah terlanjur berjalan, jalankan `git pull --ff-only` secara terpisah sebelum `npm run install`.

Frontend dibangun di laptop dan hasil `releases/frontend.tar.gz` di-commit/push ke GitHub sebelum instalasi atau update frontend. Clone dan pull di server mengambil paket tersebut bersama kode aplikasi. Paket yang hilang, rusak atau berbeda kode membuat proses berhenti sebelum pemasangan dependency aplikasi. Ubuntu hanya memasang dependency backend/bot, menghasilkan Prisma Client, membangun backend dan menyalin aset frontend. Tidak ada pengaturan batas RAM/CPU/worker tambahan atau penghentian MySQL, Apache dan FreeRADIUS untuk tahap build. Service aplikasi diaktifkan/direstart pada akhir instalasi. `npm run buildfe` adalah alias `npm run preparefe` untuk membuat paket di laptop.

Frontend production memakai `/api/wa` melalui proxy Apache sehingga port bot 3002 tidak perlu dibuka ke jaringan. Instalasi lama yang memperbarui frontend perlu menambahkan proxy `/api/wa` sebelum proxy `/api/`; contoh konfigurasi tersedia pada renderer installer. Perintah `npm install` di root juga memanggil lifecycle `install`; gunakan root project ini untuk installer Ubuntu, dan jalankan pengelolaan dependency per aplikasi dari subfolder masing-masing.

## Build frontend di laptop lalu kirim melalui GitHub

1. Gunakan folder project Windows yang sudah ada. Pasang Node.js 22 dan Git. Simpan perubahan kode frontend ke commit dahulu.
2. Jika frontend berubah atau paket belum ada, jalankan di PowerShell:

```powershell
cd "D:\1. Kuliah\Magang\Project Magang"
npm.cmd run preparefe
```

3. Commit dan push paket hasil build melalui aplikasi Git atau perintah berikut:

```powershell
git add releases/frontend.tar.gz
git commit -m "Build frontend produksi"
git push
```

4. Pada Ubuntu baru, clone repository sesuai `install.doc`, lalu jalankan dari `/var/www/Project-Magang`:

```bash
git pull --ff-only
python3 scripts/frontend-prebuilt.py --check
npm run install
```

5. Untuk server yang sudah terpasang, jalankan `npm run updatefe` untuk frontend saja, atau `npm run update` untuk seluruh aplikasi. Keduanya mengambil kode/paket terbaru melalui Git. Backend saja memakai `npm run updatebe`; paket frontend tidak perlu dibangun ulang jika frontend tidak berubah.

`preparefe` membuat build **production** dan paket `releases/frontend.tar.gz` di laptop. File paket ini ikut Git; file sementara/backup lain dalam `releases` tetap diabaikan. Server memeriksa kesamaan kode frontend dan checksum setiap aset, lalu memasang frontend tanpa dependency atau build Angular. Tidak ada upload SCP frontend. Backend/Prisma, database dan layanan lain tetap disiapkan di Ubuntu. API production memakai `/api`, sehingga paket tidak terikat IP laptop. Jika paket hilang atau tidak sesuai kode, build ulang di laptop, commit/push paket terbaru, lalu ulangi update server. Chunk lama dipertahankan dan `index.html` diganti terakhir.

Untuk server lama yang pernah menerima paket lewat SCP, pindahkan hanya paket yang belum dilacak Git sebelum pull pertama ke alur baru:

```bash
cd /var/www/Project-Magang
if [ -f releases/frontend.tar.gz ] && ! git ls-files --error-unmatch releases/frontend.tar.gz >/dev/null 2>&1; then
  backup_path="$(mktemp "$HOME/frontend-scp-backup.XXXXXX.tar.gz")"
  sudo mv -- releases/frontend.tar.gz "$backup_path"
fi
git pull --ff-only
```

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

File SQL untuk **instalasi baru** adalah [`backend/prisma/database.sql`](backend/prisma/database.sql). Semua perubahan tanpa API MikroTik sudah langsung berada di file ini, termasuk metadata NAS, Disconnect, pool per NAS, dan pengaturan awal. Gunakan database kosong pada VPS Ubuntu baru. Tidak ada file migrasi terpisah.

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

Kedua perintah tersebut menghasilkan/memeriksa file SQL tanpa menghubungi database. Klien VPN SSTP tersedia pada menu Router; field server/WireGuard lama dipertahankan untuk kompatibilitas skema.

Akun seed pengembangan:

- Admin: `admin@unzanet.com` / `123`
- Teknisi: `teknisi@unzanet.com` / `password`

Jika data akun PPPoE berasal dari Laravel, salin nilai `APP_KEY` lama ke `LARAVEL_APP_KEY` agar backend NestJS dapat mendekripsi password lama dan menyinkronkannya ke FreeRADIUS. Satu akun selalu dibatasi satu sesi melalui `Simultaneous-Use := 1`.

Dokumentasi PPPoE/FreeRADIUS berada di `backend/docs`.

Daftar Router / NAS menampilkan **Status VPN** berdasarkan sesi SSTP active di Accel-PPP (username dan IP cocok). Sesi kosong berarti Offline; kegagalan pembacaan atau data lebih dari 45 detik berarti Tidak diketahui. NAS lokal tampil Tanpa VPN. Pengumpul sesi otomatis setiap 10 detik dan web memuat ulang setiap 15 detik. Status pendaftaran NAS tetap terpisah dari koneksi VPN.

Script Router / NAS mengatur SSTP, RADIUS/Disconnect, PPP AAA, kedua pool/profil PPP dan firewall isolir. Script tidak mengimpor CA dan memakai `verify-server-certificate=no` serta `verify-server-address-from-certificate=no`. TLS tetap mengenkripsi koneksi, tetapi identitas server tidak diverifikasi sehingga ada risiko server palsu. Server SSTP tetap memerlukan sertifikat TLS. Tambah, Edit dan membuka ulang script selalu menghasilkan add untuk SSTP, route, RADIUS, pool, profil dan firewall. Dialog hanya menampilkan script dan Salin Script, tanpa pilihan mode maupun centang konfirmasi. Pengaturan tunggal PPP AAA dan RADIUS incoming tetap memakai set. Tidak ada blok if atau pencarian entri lama. Simpan NAS langsung memperbarui pool untuk RADIUS; pemasangan ke perangkat tetap melalui Terminal Winbox.

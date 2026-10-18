# PT UNZANET

Aplikasi PT UNZANET telah dimigrasikan penuh dari Laravel/Blade ke TypeScript dengan dua proyek:

- `frontend`: Angular 19, TypeScript, Tailwind CSS.
- `backend`: NestJS 12, TypeScript, Prisma ORM, MySQL.

Fitur yang dipertahankan: web profile, login JWT, dashboard, role admin/petugas, data petugas, Main Core (Server, Rasio, ODC, ODP), Trace Jalur, kalkulator redaman, paket PPPoE, akun PPPoE, dan sinkronisasi FreeRADIUS.

## Instalasi Ubuntu baru

Panduan terbaru ada di [`install.doc`](install.doc) dan [panduan teks](backend/docs/instalasi-ubuntu-vpn.md). Urutannya: Ubuntu mendapat internet dengan DHCP, instal aplikasi/database sampai website berhasil dibuka dan login, kemudian sambungkan VPN dan MikroTik jarak jauh. VirtualBox cukup memakai satu adapter NAT serta forwarding host `127.0.0.1:8080` ke guest port 80. Internet boleh berasal dari Wi-Fi, hotspot, atau provider; Ubuntu dan MikroTik tidak perlu satu LAN. Pada VPS gunakan jaringan provider. Installer ditujukan untuk Ubuntu Server 24.04 LTS baru, dengan repo di `/var/www/Project-Magang`, Node.js 22, akses internet, dan user yang memiliki sudo.

Setelah repo di-clone dan Node.js/npm tersedia, jalankan dari root project:

```bash
npm run install
```

Installer melakukan `git pull --ff-only`, memasang paket Ubuntu/dependency aplikasi, mengimpor `database.sql` hanya ketika database kosong, membuat administrator dengan password acak, membangun frontend/backend, menyiapkan Apache, MySQL, FreeRADIUS SQL, firewall, serta service systemd. Pilih mode default `web` dan isi URL browser (`http://127.0.0.1:8080` untuk NAT laptop atau alamat sebenarnya untuk VPS). Tahap ini tidak meminta akun VPN atau membutuhkan MikroTik. Konfigurasi serta secret disimpan privat di `/etc/unzanet/install.json`; password administrator awal tersedia melalui `sudo cat /etc/unzanet/credentials.txt`. Installer tidak membuat akun demo dari seed.

Setelah website berhasil login, siapkan gateway SSTP dan CA tepercaya, lalu jalankan `npm run setupvpn` pada Ubuntu aplikasi. Perintah ini menyiapkan tunnel tanpa menginstal ulang website/database atau mengganti secret aplikasi. Alamat privat tunnel ditetapkan tetap oleh gateway; alamat internet/DHCP Ubuntu tidak perlu diubah. Selanjutnya Tambah Router/NAS pada web lalu Simpan membuka script otomatis untuk dipasang pada Terminal MikroTik. Setelah router terhubung, uji ping melalui tunnel, PPPoE, dan Disconnect. Mode `vpn` saat instalasi tersedia jika gateway sudah siap; `local` hanya alternatif lab LAN. Autentikasi menggunakan UDP 1812, accounting UDP 1813, dan Disconnect UDP 3799 (RFC 5176, pengganti RFC 3576). Tidak ada login API MikroTik, kredensial admin router, SNMP, atau monitoring CPU/RAM/interface router. Password VPN router hanya dipakai untuk menghasilkan script saat itu; shared secret RADIUS tetap diperlukan/disimpan.

FreeRADIUS membaca client SQL saat startup. Worker root terpisah memvalidasi lalu menerapkan perubahan client aktif sekitar setiap 60 detik; backend web tidak diberi sudo. Status sesi bersumber dari accounting dengan batas kesegaran awal 900 detik. IP Pool berupa metadata per NAS dan script, sedangkan isolir diaktifkan setelah operator mengonfirmasi script pool/profil/firewall dipasang. QR WhatsApp tetap dipindai manual. Script tidak menebak port WAN, port pelanggan, profil dasar, atau konfigurasi PPPoE awal.

Menjalankan installer kembali mempertahankan secret dan database yang sudah ditandai. Database berisi tabel tanpa penanda installer, atau perubahan SQL terhadap instalasi berisi data, membuat installer berhenti agar tidak menimpa data. `npm run update` tetap untuk pembaruan kode setelah instalasi.

Frontend production memakai `/api/wa` melalui proxy Apache sehingga port bot 3002 tidak perlu dibuka ke jaringan. Instalasi lama yang memperbarui frontend perlu menambahkan proxy `/api/wa` sebelum proxy `/api/`; contoh konfigurasi tersedia pada renderer installer. Perintah `npm install` di root juga memanggil lifecycle `install`; gunakan root project ini untuk installer Ubuntu, dan jalankan pengelolaan dependency per aplikasi dari subfolder masing-masing.

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

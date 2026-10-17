# PT UNZANET

Aplikasi PT UNZANET telah dimigrasikan penuh dari Laravel/Blade ke TypeScript dengan dua proyek:

- `frontend`: Angular 19, TypeScript, Tailwind CSS.
- `backend`: NestJS 12, TypeScript, Prisma ORM, MySQL.

Fitur yang dipertahankan: web profile, login JWT, dashboard, role admin/petugas, data petugas, Main Core (Server, Rasio, ODC, ODP), Trace Jalur, kalkulator redaman, paket PPPoE, akun PPPoE, dan sinkronisasi FreeRADIUS.

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

Satu-satunya file SQL untuk **instalasi baru** adalah [`backend/prisma/database.sql`](backend/prisma/database.sql). File ini berisi skema terbaru dan pengaturan awal. Cukup impor file ini sekali ke database MySQL kosong. File pembaruan SQL bertahap dan script migrasi lamanya sudah dihapus.

Setelah membuat database kosong dan mengisi `backend/.env`, jalankan:

```powershell
cd backend
npx prisma db execute --file prisma/database.sql --schema prisma/schema.prisma
npm run prisma:generate
npm run db:seed
```

Alternatif: pilih database kosong di phpMyAdmin lalu impor `backend/prisma/database.sql`. Pembuatan akun awal tetap menggunakan `npm run db:seed` dari folder `backend`.

`npm run update` / `npm run updatebe` memperbarui kode, build, dan service; perintah tersebut tidak mengimpor ulang database. Untuk pengujian dari awal di VirtualBox, gunakan database kosong pada VM baru. Database yang sudah berisi data memerlukan peninjauan perubahan skema tersendiri; jangan mengimpor ulang `database.sql` ke database tersebut.

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

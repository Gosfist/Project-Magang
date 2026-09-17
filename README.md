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

Untuk database `unzanet` lama, isi `backend/.env` dengan koneksi yang sama lalu jalankan `npm run prisma:generate`. Jangan menjalankan `db:push` pada database produksi sebelum membuat backup dan meninjau perubahan skema.

Untuk database MySQL baru:

```powershell
cd backend
npm run db:push
npm run db:seed
```

Akun seed pengembangan:

- Admin: `admin@unzanet.com` / `123`
- Petugas: `petugas@unzanet.com` / `password`

Jika data akun PPPoE berasal dari Laravel, salin nilai `APP_KEY` lama ke `LARAVEL_APP_KEY` agar backend NestJS dapat mendekripsi password lama dan menyinkronkannya ke FreeRADIUS. Satu akun selalu dibatasi satu sesi melalui `Simultaneous-Use := 1`.

Dokumentasi PPPoE/FreeRADIUS dan panduan WireGuard berada di `backend/docs`.

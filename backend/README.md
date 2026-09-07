# Backend PT UNZANET

REST API NestJS + TypeScript menggunakan Prisma ORM dan MySQL.

## Perintah

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run start:dev
```

- `npm run build`: kompilasi production.
- `npm test`: menjalankan unit test.
- `npm run lint`: pemeriksaan source TypeScript.
- `npm run db:push`: membuat/menyamakan skema database baru.
- `npm run db:seed`: membuat akun demo.

Endpoint utama berada di `/api/auth`, `/api/dashboard`, `/api/users`, `/api/main-core`, dan `/api/pppoe`.

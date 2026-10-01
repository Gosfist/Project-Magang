# Peta Fitur Backend

Nama folder dan awalan file mengikuti fitur di `frontend/src/app/pages/dashboard`.
Frontend memakai `.component.ts`; backend tetap memakai suffix NestJS
`.controller.ts`, `.service.ts`, `.dto.ts`, dan `.spec.ts` sesuai tanggung jawab.

```text
home/                      dashboard utama
area/                      area dan tagihan kolektor
psb/                       pasang baru
users/                     akun pengguna
pppoe/
  data-pelanggan/           akun, billing, foto, layanan pelanggan
  paket-layanan/           paket internet
  ip-pools/                pool IP
  shared/                  RADIUS, secret, jaringan PPPoE
router/
  routers/                 router NAS
  vpn-server/
  vpn-client/
  shared/                  koneksi MikroTik/RouterOS
finance/
  transactions/
  summary/
  deposits/
  invoices/
monitoring/
  server/
  router/
  radius/
  shared/                  pengumpulan statistik
main-core/
  server/
  rasio/
  odc/
  odp/
  trace-jalur/
  shared/                  validasi dan pohon jaringan bersama
tools/pengaturan/
bot-whatsapp/shared/       pengirim notifikasi dari backend
```

Module induk menggabungkan controller/service tiap fitur. `auth`, `common`,
dan `prisma` tetap merupakan infrastruktur bersama, bukan halaman frontend.
Login, template, dan log bot WhatsApp dilayani service terpisah `bot_whatsapp/`.
CRUD Main Core memakai service bersama agar validasi relasi jaringan tidak
disalin ke empat fitur. Folder per halaman memiliki controller masing-masing.

Contoh: `pppoe/data-pelanggan/data-pelanggan.service.ts` menggantikan
service akun lama `pppoe/pppoe.service.ts`. Tes billing berada di
`pppoe/data-pelanggan/billing-cycle.spec.ts`.

Pemindahan ini tidak memerlukan migrasi database dan tidak mengganti URL API.
Jalankan `npm run build` dan `npm test` dari folder `backend` untuk verifikasi.

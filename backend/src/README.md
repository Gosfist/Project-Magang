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
  isolation/               pool/profil isolir dan sinkronisasi sesi
  shared/                  RADIUS, Disconnect UDP, accounting, script PPPoE
router/
  routers/                 router NAS
  vpn/                     klien SSTP VPS dan kredensial terenkripsi
  shared/                  pembuat script setup NAS tanpa koneksi API router
finance/
  transactions/
  summary/
  deposits/
  invoices/
monitoring/
  server/
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
tools/backup/              script lokal/RADIUS dan backup/impor Excel PPPoE
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

Arsitektur tanpa API MikroTik menghapus endpoint monitoring router dan tes login
API. Pemutusan sesi melalui RADIUS Disconnect UDP 3799; status sesi menggunakan
accounting yang masih segar. Metadata pool dan konfigurasi perangkat menghasilkan
script yang dipasang operator. Skema aktif sudah langsung berada di
`prisma/database.sql` untuk instalasi baru pada database kosong. Tidak ada file
migrasi terpisah; updater tidak mengubah skema database lama.
Jalankan `npm run build` dan `npm test` dari folder `backend` untuk verifikasi.
Lihat [hasil audit lokal tanpa API MikroTik](../docs/audit-tanpa-api-mikrotik.md)
untuk cakupan pemeriksaan, jalur tiap fitur, hasil tes, dan batas validasinya.

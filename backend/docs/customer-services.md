# Update Data Pelanggan: filter, log, invoice, Add-ons, Janji Bayar

Frontend dan backend perlu diperbarui bersama. Seluruh tabel dan perubahan tanpa API tercakup langsung dalam [`../prisma/database.sql`](../prisma/database.sql). Gunakan VM VirtualBox baru dengan database kosong; tidak ada migrasi terpisah. Jangan mengimpor ulang SQL lengkap ke database berisi data.

Untuk instalasi baru, sesudah membuat database kosong dan mengisi `backend/.env`, jalankan di Ubuntu:

```bash
cd /var/www/Project-Magang/backend
npm ci
npx prisma db execute --file prisma/database.sql --schema prisma/schema.prisma
npm run prisma:generate
npm run db:seed
npm run build
cd ../frontend
npm ci
npm run build -- --delete-output-path=false
```

Jalankan perintah berurutan dan lanjut hanya jika perintah sebelumnya berhasil. `prisma db execute` memakai DATABASE_URL dari `backend/.env`; tidak perlu menampilkan password atau menyalin URL ke terminal. Setelah build, konfigurasikan service backend, bot WhatsApp, Apache, dan FreeRADIUS sesuai VM baru; Apache melayani `frontend/dist/frontend/browser`. Lihat [panduan database](../../README.md#database). Untuk update kode pada instalasi yang sudah berjalan, jangan mengimpor ulang SQL instalasi.

## Perilaku

- Filter Status dan Sesi digabung dengan pencarian sebelum paginasi. Sesi diambil dari accounting RADIUS yang segar; data terlambat atau NAS yang tidak dikenal tetap tidak diketahui dan tidak dihitung sebagai Offline. Default batas kesegaran 900 detik; tidak ada login API atau SNMP.
- Log autentikasi: sepuluh baris terbaru `radpostauth` untuk username pelanggan, diurutkan waktu dan ID. Password pada tabel tersebut tidak dikirim ke browser. Jika kosong, periksa apakah FreeRADIUS menjalankan `sql` pada `post-auth` dan `Post-Auth-Type REJECT`.
- Invoice menampilkan data invoice yang sudah tersimpan. PENDING lewat tanggal jatuh tempo ditampilkan OVERDUE. Catat pembayaran memerlukan konfirmasi pembayaran sudah diterima; ini pencatatan manual, bukan integrasi payment gateway.
- Add-ons adalah biaya tambahan sekali tagih: nama, nominal, tanggal jatuh tempo, catatan. Penyimpanan membuat add-on dan invoice ADDON dalam satu transaksi. Tidak ada penagihan Add-on berulang otomatis.
- Janji Bayar memerlukan invoice PENDING/OVERDUE dan paket aktif; hanya satu janji aktif per pelanggan. Janji menyimpan ID invoice terkait sehingga invoice baru tidak ikut mengubah janji yang sudah dibuat.
- Batas janji sampai akhir tanggal yang dipilih dalam WIB. Contoh 18 September berakhir 19 September 00:00 WIB, yaitu 18 September 17:00 UTC. RADIUS diberi Expiration Unix seconds untuk menghindari perbedaan zona waktu server.
- Pastikan modul `expiration` aktif setelah SQL di `authorize` FreeRADIUS. Modul tersebut membatasi autentikasi dan Session-Timeout; lihat [dokumentasi FreeRADIUS](https://wiki.freeradius.org/modules/rlm-expiration). Format integer date didukung oleh [parser FreeRADIUS 3.2](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/src/lib/value.c).
- Backend memeriksa janji saat mulai dan setiap menit. Jika belum lunas setelah batas, akun diisolir, data RADIUS disinkronkan, lalu Disconnect Request UDP dikirim sesudah commit. Kegagalan NAS dicoba ulang tanpa API. Backend harus tetap berjalan untuk penegakan sesi aktif dan retry; mode pool isolir dan penolakan login memiliki atribut RADIUS masing masing.
- Setelah semua invoice terkait lunas, janji menjadi Terpenuhi. Masa aktif lama dipertahankan jika masih berlaku; bila sudah lewat, diperpanjang sejumlah validityDays paket sejak pelunasan. Isolir manual membatalkan janji agar pembayaran tidak mengaktifkan akun yang dinonaktifkan manual.

## Pemeriksaan server

```bash
sudo journalctl -u unzanet-backend -n 80 --no-pager
sudo freeradius -XC
```

Uji pelanggan percobaan: filter Aktif/Offline, periksa log autentikasi setelah dial PPPoE, buat Add-on dan cek invoice, buat janji lalu catat pembayaran invoice terkait. Verifikasi status aktual lewat `/ppp active print` di MikroTik. Jangan menganggap build atau data browser mock sebagai bukti bahwa router produksi sudah teruji.

## Zona waktu log autentikasi

FreeRADIUS 3 menulis post-auth `authdate` dengan `%S.%M` (waktu lokal proses), sedangkan Prisma membaca field tanggal SQL sebagai UTC. API log pelanggan dan Monitoring RADIUS menafsirkan kembali waktu tersebut sesuai `RADIUS_LOG_TIMEZONE` sebelum mengirim ISO UTC. Default WIB sesuai server lab Asia/Jakarta. Gunakan UTC jika timestamp yang dibaca Prisma memang sudah UTC; WITA/WIT tersedia untuk penyimpanan lokal zona tersebut. Konfigurasi ini hanya memengaruhi authdate, bukan invoice, header, atau waktu sistem. Tidak mengubah log tersimpan.

Verifikasi di server: cocokkan `date`, tanggal SQL authdate terbaru, JSON endpoint auth-logs, dan tampilan WIB setelah autentikasi uji. Jika data SQL/API sudah UTC, gunakan RADIUS_LOG_TIMEZONE=UTC agar tidak dikoreksi dua kali.

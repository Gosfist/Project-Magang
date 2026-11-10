# Bot WhatsApp UNZANET

Bot memakai Go 1.27.3 dan whatsmeow untuk satu nomor WhatsApp. Endpoint `/api/wa` tetap kompatibel dengan dashboard Angular dan notifikasi backend NestJS. Database aplikasi tetap MySQL; tidak memakai Supabase.

Template di `website_settings` dan riwayat di `bot_wa_logs` tetap menggunakan `DATABASE_URL` MySQL yang sama dengan backend. Pool bot dibatasi dua koneksi, satu koneksi idle. Koneksi gagal membuat startup/health gagal secara jelas, tanpa fallback ke database kosong atau menampilkan URL/password.

Sesi perangkat menggunakan `data/whatsmeow.db` (SQLite embedded, tanpa service database tambahan). whatsmeow mendukung sesi SQLite/PostgreSQL, bukan MySQL. Direktori sesi dilindungi dan diabaikan Git. Chat history tidak diunduh otomatis karena bot hanya mengirim notifikasi. Sesi Baileys tidak kompatibel: scan QR lagi setelah migrasi. Sesi Go berikutnya dipakai kembali setelah restart. Reset menghapus sesi lokal saja; untuk melepas perangkat di server WhatsApp gunakan Logout atau menu Perangkat Tertaut di ponsel.

## Lokal

Pasang Go 1.27.3, lalu dari folder ini:

```powershell
Copy-Item .env.example .env
# Isi DATABASE_URL MySQL dan BOT_API_KEY yang sama dengan backend.
go mod download
go test ./...
go run . --check-db
go run .
```

Jika `.env` sudah ada, edit file tersebut; jangan menimpanya dengan contoh. Jalankan backend untuk verifikasi token admin. Host default `127.0.0.1`, port default `3002`; frontend production menggunakan proxy Apache. Go tidak memerlukan JWT_SECRET karena validasi token/role dilakukan ke `/api/auth/me` backend pada setiap permintaan pengelolaan.

## VPS Ubuntu

Dari root repo yang sudah terpasang:

```bash
npm run updatebot
sudo systemctl status unzanet-botwa --no-pager
curl --fail http://127.0.0.1:3002/api/wa/health
```

Updater mengambil kode Git dan mem-build Go secara serial. Service lama diganti menjadi executable Go, termasuk instalasi yang memiliki `/etc/unzanet/install.json`. `.env` bot disinkronkan dari backend; data MySQL dan `auth_info` lama tidak dihapus. Sesudah updater berhasil, buka dashboard Login Bot Wa dan scan QR. Pengiriman nyata belum terbukti hanya dari health: uji Ping ke nomor sendiri dan satu alur notifikasi aplikasi.

Untuk build manual di Ubuntu, `bash scripts/build-bot.sh` dari root repo. Compiler Go 1.27.3 diunduh dari go.dev dengan verifikasi SHA256 bila belum tersedia (butuh root untuk pemasangan compiler). Runtime bot tidak memerlukan compiler. `CGO_ENABLED=0` menghasilkan binary mandiri, termasuk zona waktu Asia/Jakarta. Build di laptop Linux dengan arsitektur VPS yang sama juga dapat digunakan bila RAM build VPS terbatas.

## API dan pengujian

- Publik: `GET /health`; mengembalikan 503 bila MySQL tidak tersedia.
- API key backend (`X-API-Key`): `POST /send`, body `{ "phone": "081234567890", "message": "..." }`.
- Bearer admin: status, QR, connect, restart, reset, logout, ping, template GET/PATCH dan log GET/DELETE.
- QR berupa data URL PNG; status tetap menggunakan `qrAvailable`, `botNumber`, `connectedAt` dalam milidetik, dan `uptime` dalam detik.
- Tidak ada antrean pesan atau retry otomatis di dalam bot agar pesan yang hasilnya belum pasti tidak terkirim ganda. Backend menerima hasil pengiriman dengan format respons lama.

Ukur RAM proses setelah pairing dan saat beban normal; ukuran executable atau health lokal tidak membuktikan penghematan RAM dibanding bot lama.

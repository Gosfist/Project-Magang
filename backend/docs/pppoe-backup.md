# Pengaturan > Backup Akun PPPoE

Fitur khusus administrator. Menyediakan script darurat lokal MikroTik, script
kembali ke RADIUS, backup Excel, template, dan impor akun. Tidak memerlukan
migrasi database. Pengaturan nonsensitif per router memakai AppSetting
`pppoe_backup_router_{id}`. Unduhan tidak menghubungi atau mengubah MikroTik.

## Persiapan sebelum gangguan

1. Login admin, buka Pengaturan, pilih tab Backup dan router yang sesuai.
2. Isi Gateway PPPoE Internet serta nama Profil Dasar PPPoE yang benar-benar
   tersedia pada router. Profil dasar menjadi sumber DNS, parent queue, dan
   pengaturan lainnya. Simpan Pengaturan Backup.
3. Unduh Script Lokal Darurat dan Script Kembali ke RADIUS. Simpan keduanya di
   komputer yang dapat digunakan ketika web/server tidak tersedia. Unduh ulang
   setelah perubahan akun/password/paket/status pelanggan.
4. Unduh Backup Excel per router atau seluruh akun untuk pemulihan data web.

Script lokal dan backup Excel mengandung password PPPoE asli. Endpoint admin
memakai JWT dan Cache-Control private/no-store. Password tidak ditampilkan pada
daftar/pratinjau atau disimpan sebagai file di server oleh fitur ini.

## Script lokal darurat

Paste seluruh isi file `.rsc`, termasuk kurung pembuka/penutup, di Terminal router
yang dipilih. Pool internet Harga Paket dan profil dasar harus sudah tersedia.
Preflight memeriksa seluruh pool, nama profil, dan konflik secret sebelum mutasi.
Secret lokal yang tidak bertanda aplikasi tidak ditimpa.

Script membuat/memperbarui profil `UNZANET-BACKUP-{router}-PKG-{paket}` dan secrets
PPPoE dengan marker `UNZANET-BACKUP:{router}:ACCOUNT:{nomorPelanggan}`. Username,
password, pool, dan rate-limit mengikuti data web. Parameter string meng-escape
karakter RouterOS, termasuk dolar, kutip, backslash, kontrol, dan UTF-8.
Menjalankan file yang sama lagi memperbarui entri terkelola tanpa menggandakannya.
Secret cadangan lama yang tidak lagi ada di snapshot dinonaktifkan.

RADIUS global tidak dimatikan: autentikasi pelanggan dengan secret lokal aktif
memakai data lokal. Akun tanpa Router/NAS tidak masuk script router.

Jika mode pool isolir aktif, akun isolir tetap aktif dengan profil lokal isolir,
pool isolir, tanpa IPv6, dan tiga drop terkelola sebelum rule biasa/FastTrack.
Pool isolir harus sudah tersedia. Tanpa mode pool isolir, akun isolir dalam
snapshot memakai secret nonaktif. Masa berlaku, paket nonaktif, dan janji bayar
yang kedaluwarsa diperiksa saat pembuatan file.

Ini snapshot, bukan pengganti billing otomatis. Pembayaran/perubahan web setelah
file diunduh tidak memperbarui file maupun secret lokal. Tidak ada scheduler
yang otomatis mendeteksi RADIUS mati atau otomatis mengaktifkan secrets.

Checkbox Sambungkan ulang sesi menentukan apakah script menghapus sesi PPPoE
akun cadangan satu kali. Default tidak dicentang agar sesi aktif tetap berjalan.
Centang jika perubahan mode/pool harus langsung berlaku pada sesi yang sudah
terhubung. Script tetap memerlukan uji dial pada RouterOS yang digunakan.

## Kembali ke RADIUS

Setelah server sehat, pastikan autentikasi dan accounting RADIUS berfungsi.
Jalankan Script Kembali ke RADIUS. Script mengaktifkan `use-radius=yes`, lalu
menonaktifkan hanya secrets PPPoE dengan marker backup router tersebut. Tidak
menghapus secret, pool, profil, atau rule isolir. Secret lokal lain tidak diubah.
Jika checkbox reconnect aktif saat unduhan, sesi terkait disambungkan ulang;
jika tidak, sesi aktif beralih pada login berikutnya. Periksa autentikasi baru
di Monitoring RADIUS, IP/pool, queue, dan status `/ppp active print`.

## Excel

- `.xlsx`, sheet `Akun PPPoE`, nama/urutan 18 kolom mengikuti template. Workbook
  memiliki sheet Petunjuk, Contoh terpisah, serta referensi paket/router/area/ODP.
  Contoh tidak berada pada sheet impor agar tidak terimpor tanpa sengaja.
- Nomor pelanggan, WA, KTP, ID, dan password berupa teks sehingga nol depan tetap
  tersimpan dan nilai yang diawali tanda sama dengan tetap teks, bukan formula.
- Ini backup akun, bukan dump database penuh. Invoice, pembayaran, foto, PSB,
  janji bayar, konfigurasi isolir, paket, dan router tidak direstorasi dari file.
  Referensi pada server tujuan harus disiapkan; ID referensi dapat disesuaikan
  sebelum impor. Kolom foto tidak ada, sehingga foto akun lama tetap dipertahankan.
- Akun belum ditugaskan bisa memakai router_id kosong; baru masuk script setelah
  Router/NAS diisi. Area/ODP juga boleh kosong untuk pemulihan data lama.
- Maksimal 1.000 baris data dan file 5 MB per impor. Backup yang lebih besar perlu
  dibagi menjadi beberapa file dengan header yang sama sebelum diimpor.
- Tambah saja menolak username lama. Tambah/perbarui mencocokkan username secara
  persis dan nomor pelanggan harus sama. Akun tidak dihapus oleh impor.
- Tekan Periksa File untuk melihat baris/tambah/perbarui/konflik. Password tidak
  dikirim dalam pratinjau. Formula, objek, arsip berlebihan, referensi tidak valid,
  dan nomor/username/WA/KTP duplikat ditolak.
- Tiket pratinjau berlaku 10 menit, terikat file/mode/admin dan keadaan data server.
  Jika file/mode/data berubah, ulangi Periksa File.
- Import memvalidasi ulang dalam transaksi Serializable lalu mengenkripsi password
  dan menyinkronkan RADIUS. Kegagalan membatalkan seluruh file. Tidak membuat invoice,
  mengirim WhatsApp, mengubah secrets router, atau memutus sesi aktif otomatis.

## Validasi

Tes lokal memeriksa escaping/preflight/pembatasan script, unduhan workbook nyata,
roundtrip nilai teks/password, validasi impor, rollback RADIUS, tiket pratinjau,
otorisasi HTTP, dan tampilan tab/form. Tes tidak mengeksekusi script pada RouterOS.
Deployment, paste terminal, autentikasi lokal, lalu kembali ke RADIUS tetap perlu
dibuktikan pada router uji dengan satu pelanggan terlebih dahulu.

Referensi resmi: [PPP AAA](https://manual.mikrotik.com/docs/authentication-authorization-accounting/ppp-aaa/),
[Scripting RouterOS](https://manual.mikrotik.com/docs/developer-guides/scripting/).

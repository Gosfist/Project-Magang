# Pengaturan > Backup Akun PPPoE

Fitur khusus administrator. Menyediakan script darurat lokal MikroTik, script
kembali ke RADIUS, backup Excel, template, dan impor akun. Tidak memerlukan
migrasi database. Pengaturan nonsensitif per router memakai AppSetting
`pppoe_backup_router_{id}`. Unduhan tidak menghubungi atau mengubah MikroTik.

Arsitektur aktif tidak menggunakan API MikroTik atau SNMP. Pool/profil dasar pada
router tetap dipersiapkan operator lewat script; data pool web adalah metadata.
Backup darurat tetap dipasang melalui Terminal dan tidak mengaktifkan koneksi API.

## Persiapan sebelum gangguan

1. Login admin, buka Pengaturan, pilih tab Backup dan router yang sesuai.
2. Untuk NAS dengan prefix tersimpan, gateway/profil/pool internet otomatis
   mengikuti Router NAS dan tidak perlu disimpan ulang di Backup. Untuk NAS lama,
   isi Gateway PPPoE Internet serta Profil Dasar PPPoE yang benar-benar tersedia,
   lalu Simpan Pengaturan Backup. Profil dasar menjadi sumber DNS/parent queue.
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
pool isolir, tanpa IPv6, dan tiga drop khusus backup sebelum rule biasa/FastTrack.
Rule backup memakai komentar `UNZANET-BACKUP:{router}:FIREWALL:ROUTER/IN/OUT`;
script lokal tidak mengganti atau menghapus rule `UNZANET-ISOLIR` utama.
Pool isolir harus sudah tersedia. Tanpa mode pool isolir, akun isolir dalam
snapshot memakai secret nonaktif. Masa berlaku, paket nonaktif, dan janji bayar
yang kedaluwarsa diperiksa saat pembuatan file.

Ini snapshot, bukan pengganti billing otomatis. Pembayaran/perubahan web setelah
file diunduh tidak memperbarui file maupun secret lokal. Tidak ada scheduler
yang otomatis mendeteksi RADIUS mati atau otomatis mengaktifkan secrets.

Checkbox Sambungkan ulang sesi saat import lokal menentukan apakah script lokal
menghapus sesi PPPoE akun cadangan satu kali. Default tidak dicentang agar sesi aktif tetap berjalan.
Centang jika perubahan mode/pool harus langsung berlaku pada sesi yang sudah
terhubung. Script tetap memerlukan uji dial pada RouterOS yang digunakan.

## Kembali ke RADIUS

Setelah server sehat, pastikan autentikasi dan accounting RADIUS berfungsi.
Jalankan Script Kembali ke RADIUS. Script mengaktifkan `use-radius=yes`, lalu
menghapus seluruh secrets PPPoE dengan marker backup router tersebut, termasuk
cadangan lama yang sudah nonaktif. Sesi PPPoE setiap akun backup selalu diputus
satu kali setelah secret dihapus agar autentikasi berikutnya memakai RADIUS dan
resource dinamis sesi lokal (interface/queue) dilepas oleh RouterOS. Tidak ada
penghapusan queue atau interface secara global. Akun pada database web tetap tersimpan.
Setelah itu script menghapus profil cadangan normal dan isolir dengan nama
`UNZANET-BACKUP-{router}-PKG/ISOLIR-*` dan komentar kepemilikan lengkap yang cocok.
Profil lama yang secrets-nya sudah dihapus juga dibersihkan; tidak bergantung
pada daftar akun saat ini. Profil yang masih direferensikan secret lain atau
default-profile server PPPoE dilewati dengan pesan terminal. Jika router menolak
penghapusan, kegagalan dilaporkan dan profil berikutnya tetap diproses. Jumlah
profil dihapus/dilewati ditampilkan di akhir; periksa pesan jika ada yang tersisa.
Terakhir script menghapus semua rule firewall dengan tiga komentar backup persis
di atas, termasuk duplikat dari import lama. Jika masih ada profil cadangan yang
belum dapat dihapus, firewall cadangan dipertahankan dan dilaporkan agar proteksi
isolir sesi yang masih memakai cadangan tidak dilepas. Kegagalan penghapusan rule
dilaporkan; script tidak menyatakan pembersihan selesai jika ada yang dilewati.
Profil asli/default/paket, pool, profil `UNZANET-ISOLIR-{router}` dan rule isolir
utama tetap diperlukan oleh RADIUS dan dipertahankan. Secret lokal lain tidak diubah.
Periksa autentikasi baru di Monitoring RADIUS, IP/pool, queue, dan status
`/ppp active print`. Import lokal berikutnya akan membuat konfigurasi cadangan
baru dari data terbaru. Unduh ulang kedua script setelah pembaruan fitur ini;
file lama tidak berubah otomatis.

Cakupan perubahan script lokal adalah secrets, profil, tiga rule firewall backup
dan reconnect opsional. Script tidak membuat pool, profil dasar, queue statis,
NAT, address-list, scheduler, repository script, ataupun file pada router.
Pool/profil dasar adalah prasyarat, sehingga tidak menjadi objek pembersihan.
Script lokal versi lama mengganti rule dengan marker `UNZANET-ISOLIR` yang sama
dengan konfigurasi RADIUS; asal rule tersebut tidak dapat dibedakan. Rule bersama
itu dipertahankan agar isolir RADIUS tetap bekerja. Versi baru memisahkan marker
rule backup sehingga seluruh konfigurasi khusus backup dapat dibersihkan.

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
- Upload menerima satu file dan hingga dua kolom formulir (mode dan token).
  Pesan `Too many parts` terkait batas multipart HTTP, bukan jumlah baris Excel.
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

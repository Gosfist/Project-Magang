# Panduan arsitektur tanpa API MikroTik

Panduan [konfirmasi antarmuka](konfirmasi-antarmuka.md) menjelaskan penggantian
seluruh konfirmasi hapus bawaan browser dengan modal aplikasi seperti Hapus Klien VPN.

Dashboard administrator merangkum pelanggan, pemasangan dalam proses, akun PSB
yang menunggu penyelesaian, Router/NAS terdaftar, Finance bulan berjalan (WIB),
setoran menunggu ACC, tagihan belum lunas seluruh periode, status Bot WhatsApp,
serta jaringan dan tim. Akses Cepat mengarah ke sepuluh menu utama. Data berasal
dari API dan diperbarui setiap menit saat halaman terlihat; tombol Perbarui dapat
digunakan kapan saja. Kegagalan satu sumber ditampilkan sebagai data tidak tersedia,
bukan angka nol atau status bot terputus. Kartu Router/NAS menunjukkan jumlah
perangkat terdaftar. Dashboard role Finance, Sales, Kolektor dan Teknisi
tetap menggunakan ringkasan masing-masing. Pembaruan ini memerlukan backend dan
frontend terbaru.

Navigasi dari Akses Cepat otomatis membuka dropdown induk tujuan di sidebar,
termasuk PPPoE, Router, Bot WhatsApp dan menu role. Main Core berada di Teknisi,
sedangkan Data Area berada di Kolektor. Sinkronisasi juga berlaku saat membuka
URL langsung atau berpindah halaman melalui riwayat browser.

Halaman publik menampilkan menu hamburger di layar di bawah 768px untuk Beranda,
Tentang Kami, Layanan, dan Kontak. Menu ditutup setelah memilih tautan, menekan
tombol lagi, atau menekan Escape. Kartu paket tersusun satu kolom di bawah 640px,
dua kolom mulai 640px, dan tiga kolom mulai 768px. Paket berikutnya turun ke baris
baru tanpa carousel atau gulir horizontal.

Panduan [Kalkulator Redaman](kalkulator-redaman.md) memuat input, rumus dan contoh
perhitungan ODC → ODP, ODP → ODP, pembagian port Rasio, contoh rantai, batas
perhitungan otomatis, serta penjelasan untuk presentasi/sidang.
Perhitungan frontend kini diperbarui setiap input/splitter/jalur berubah;
hasil kosong tidak lagi tersimpan dari render awal. Daya sumber/masuk memakai dBm (semakin negatif semakin lemah), sedangkan loss memakai dB. Panduan yang sama mencakup Server, Rasio, ODC, ODP, margin per segmen, sumber kosong, dan pembulatan frontend/backend. Semua segmen menuju Rasio/ODC/ODP memakai 2 konektor masing-masing 0,5 dB dan kabel 0,35 dB/km, sama dengan nilai awal kalkulator; daya masuk belum dikurangi splitter tujuan.

Tambah langsung di PPPoE > Data Pelanggan kini dua tahap: Data Pelanggan termasuk
pilih Layanan, lalu Data Akun PPPoE. Pengaturan pembayaran manual dihapus dari
pendaftaran baru. Pascabayar, tanggal mulai server, dan penagihan bulan berikutnya
mengikuti aturan otomatis Sales ke Teknisi. Rincian pada panduan operasi Router/PPPoE.

Kolom Router/NAS kini Status VPN, berdasarkan sesi SSTP active dengan username dan
IP yang cocok di Accel-PPP, bukan isActive pendaftaran NAS. Sesi kosong berarti
Offline; data gagal/usang berarti Tidak diketahui; NAS lokal tampil Tanpa VPN.
Worker read-only unzanet-vpn-status.timer berjalan setiap 10 detik, web memuat
ulang setiap 15 detik. Installer/update memasangnya melalui setup-vpn-sync.sh.
Bagian 9.6 memuat pemeriksaan timer dan show sessions.

Bagian 9.7 membedakan status layanan Aktif dari sesi PPPoE Online/Offline/Belum
diketahui, serta memeriksa mismatch zona UTC/WIB pada accounting. Instalasi baru
memakai sesi SQL UTC dan pembacaan backend UTC; tampilan tetap WIB. Pasang Baru
dan Data Pelanggan membaca radacct tanpa API MikroTik.

Jam server, backend/bot dan proses FreeRADIUS memakai Asia/Jakarta; NTP server
diaktifkan. MySQL dipatok +00:00 saat berjalan dan restart, serta koneksi SQL
FreeRADIUS memakai UTC untuk radacct. Authdate ditulis waktu proses Jakarta dan
dibaca dengan RADIUS_LOG_TIMEZONE=WIB. Bagian 9.9 memuat pemeriksaan dan langkah
VPS lama yang accounting-nya sudah UTC. Script NAS juga mengatur zona Jakarta;
NTP router perlu diperiksa melalui Winbox sesuai versi RouterOS.
Bagian 9.8 dan [panduan bandwidth](pppoe-bandwidth.md) memuat kasus terverifikasi
queue wisnu 20M/20M dengan counter nol: setelah profil memakai parent CLIENT dan
login ulang, counter bertambah, rate download 19.1 Mbps dan speedtest berhasil.

Panduan aktif adalah [instalasi VPS Ubuntu](instalasi-ubuntu-vpn.md),
[FreeRADIUS](pppoe-freeradius.md), [operasi Router dan PPPoE](router-pppoe-operations.md),
[isolir](pppoe-isolation.md), dan [backup darurat](pppoe-backup.md).
Versi Word terbaru berada pada `install.doc` di root repo.
Bagian awal memuat panduan bergambar firewall DigitalOcean untuk pemula:
menu yang diklik, aturan 22/80/443/4443, Sources/Action, Outbound Rules,
Apply to Droplets, dan pemeriksaan hasil. Gambar ilustrasi serta satu screenshot
resmi berada di `images/`; sumber gambar dicantumkan pada panduan.
Urutan: siapkan VPS/DNS, build frontend di laptop, commit/push paket,
clone/pull VPS, lalu sekali `npm run install` untuk aplikasi, HTTPS, dan server VPN.
Installer meminta domain, IPv4 publik VPS, serta email aktif untuk sertifikat satu
kali. Email ini berbeda dari akun administrator. Gunakan DNS only pada Cloudflare
saat instalasi; aktifkan Proxied dan Full (strict) setelah HTTPS berhasil.
Website, RADIUS, dan VPN berada satu mesin; tidak perlu VPN client Ubuntu.
Bot WhatsApp menggunakan Go 1.27.3 + whatsmeow. Template/log tetap MySQL; sesi
perangkat memakai SQLite lokal tanpa service tambahan. `npm run updatebot`
mengganti service Node lama dengan executable Go dan menyinkronkan koneksi bot.
Sesudah migrasi Baileys, scan QR sekali lagi melalui Login Bot Wa.
Login web, buat Klien VPN, tunggu penerapan sekitar 15 detik, pilih akun pada Router/NAS,
lalu isi prefix IP Pool Internet dan Isolir pada form Router NAS. Script mengatur
SSTP, RADIUS/Disconnect, PPP AAA, kedua pool/profil dan firewall isolir. Tambah,
Edit dan membuka ulang script selalu memakai add untuk entri daftar, tanpa blok if,
pilihan mode atau centang pemasangan. Submenu IP Pool dan Isolir lama diarahkan ke Router / NAS.
Akun dan IP diambil otomatis. Gunakan sekali untuk pemasangan awal; pengulangan
dapat membuat entri ganda atau bentrok nama tunnel.
Nama interface SSTP, gateway rute dan komentar VPN memakai `UNZANET-RADIUS:VPN`;
pool internet memakai `UNZANET-RADIUS:INTERNET`, pool/firewall isolir `UNZANET-RADIUS:ISOLIR`.
Bagian 7 menjelaskan penggantian nama tunnel lama melalui Winbox tanpa paste ulang.
Setelah paste script, periksa rule isolir sebelum accept/FastTrack. Simpan NAS
langsung memperbarui pool untuk RADIUS dan menjadwalkan sinkronisasi saat prefix
berubah. Harga Paket mengatur harga/kecepatan, pool mengikuti NAS.
Tidak ada impor CA; verifikasi sertifikat server dimatikan sesuai mode sederhana.
TLS tetap dipakai, tetapi identitas server tidak diverifikasi sehingga ada risiko server palsu.
Password langsung terlihat pada daftar khusus admin; kolom Status dihapus.
Ikon Edit mengganti nama, username dan password. Ikon Hapus memakai konfirmasi;
akun yang masih dipakai NAS harus dilepas/diganti dahulu. Setelah kredensial
berubah, ubah User/Password interface SSTP yang sudah ada melalui Winbox.
Jangan paste ulang script add. IP VPN tetap saat edit.
SSTP memakai 4443; HTTPS website memakai 443.
Akun administrator awal dibuat otomatis: `admin@unzanet.com` / `123`, tanpa
pertanyaan email/password dan tanpa password admin acak. Akun yang sudah ada
tidak direset ketika installer diulang.
Instalasi lama dapat dilengkapi melalui perintah install yang sama. Sertifikat
HTTPS diperiksa langsung pada origin dan timer pembaruannya diaktifkan; CA dan
akun SSTP terkelola dipertahankan ketika instalasi diulang.
Pemulihan installer yang berhenti saat membaca port SSH ada pada bagian 9.1:
tampilkan error `sshd -T`, buat `/run/sshd` jika memang belum ada, validasi
konfigurasi, lalu ulangi instalasi tanpa mereset database.
Bagian 9.3 memuat pemulihan menu yang gagal memuat chunk JavaScript:
Ctrl+Shift+R atau tab baru, pemeriksaan Network, serta pemulihan paket frontend
jika file benar-benar hilang. Membuka ulang browser berbeda dari update VPS.
Bagian 9.4 memperbaiki bad parameter allow pada script SSTP: gunakan
authentication=mschap2, pasang pembaruan backend, lalu salin ulang script dan
periksa tunnel. Pada router yang sudah terpasang, ubah entri melalui Winbox;
script terbaru selalu add dan tidak memeriksa entri lama.
Bagian 9.5 memuat pemasangan template sederhana tanpa impor CA atau centang
konfirmasi, serta pembaruan backend dan UI beserta paket frontend laptop.

Panduan instalasi lama sudah dihapus agar tidak ada alur yang saling bertentangan.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

Setiap kesalahan yang ditemukan saat instalasi atau operasi harus dikoreksi juga
pada panduan terkait. Untuk alur instalasi, perbarui [sumber Markdown](instalasi-ubuntu-vpn.md) dan
`install.doc` bersamaan, pertahankan langkah langsung per perangkat, lalu render
dan periksa setiap halaman Word sebelum commit/push. Perbaikan kode installer
harus disertai langkah pemulihan untuk konfigurasi lama bila diperlukan.

Panduan [port aktivasi PSB](port-aktivasi-psb.md) memuat pilihan port, penanganan port terpakai, dan pembaruan skema database lama sebelum deployment.

## Uptime pelanggan dari accounting

Uptime web dihitung dari durasi `Acct-Session-Time` pada pembaruan accounting terakhir ditambah waktu yang sudah berlalu sejak `acctupdatetime`. Sebelum interim pertama, nilai durasi 0 tetap bertambah berdasarkan waktu Accounting-Start. Refresh daftar pelanggan setiap 5 detik tidak boleh membuat hitungan kembali ke 0. Sesi accounting baru tetap memulai uptime baru; sesi stale atau tidak diketahui tidak ditampilkan seolah-olah online. Zona waktu mengikuti `RADIUS_ACCOUNTING_TIMEZONE`.

Perbaikan perhitungan uptime hanya memerlukan backend terbaru (`npm run updatebe` di root project VPS); tidak perlu rebuild frontend atau perubahan skema database. Bandingkan uptime dan session-id melalui `/ppp active print detail` untuk membedakan bug tampilan dari PPPoE yang benar-benar dial ulang. Validasi lokal belum membuktikan stabilitas sesi perangkat nyata.

## Audit logika 11 November 2026

Koreksi deployment setelah audit: folder hasil `mkdtemp` berizin 0700 di Linux. Jika updater root memindahkannya menjadi `backend/dist`, user service tidak dapat membaca main.js dan Node dapat melaporkan MODULE_NOT_FOUND. Builder kini menormalkan direktori menjadi 0755 dan file menjadi 0644 sebelum promosi. Pemulihan VPS: `sudo chmod -R u=rwX,go=rX /var/www/Project-Magang/backend/dist`, lalu `sudo systemctl restart unzanet-backend`. Updater memeriksa status aktif setelah restart dan berhenti bila service gagal; pemeriksaan ini bukan pengujian penuh endpoint login. Tes permission POSIX dilewati pada Windows dan tetap perlu dijalankan di Linux.

Lihat [laporan audit logika](AUDIT_LOGIKA_2026-11-11.md) untuk temuan, perbaikan, bukti tes dan batas validasi. Pembuatan tagihan bulanan memakai batch berurutan sampai semua pelanggan selesai. ACC/Tolak/Batal ACC/Hapus setoran memeriksa status secara atomik agar permintaan bersamaan tidak mencatat pemasukan ganda atau menimpa status terbaru. Pencatatan setoran baru mengunci invoice sebelum memeriksa duplikasi.

Scheduler isolir memeriksa kembali kelayakan secara atomik sebelum menonaktifkan akun: tagihan PENDING/OVERDUE masih jatuh tempo dan belum dilindungi janji bayar aktif. Kandidat yang berubah setelah daftar batch diambil tidak boleh diputus berdasarkan daftar lama.

Main Core menolak siklus jalur dan penyusutan splitter yang masih memakai port di luar kapasitas baru. Penghapusan titik memakai lock yang sama dengan penempatan pelanggan. Foto aktivasi baru menggunakan file terpisah; kegagalan transaksi tidak menimpa foto tersimpan. Preview foto mengabaikan respons lama setelah pindah pelanggan. Pengaktifan ulang paket meminta sesi pelanggan tersambung ulang setelah commit agar atribut internet menggantikan profil isolir.

Profil PPP hasil script baru memakai `parent-queue=none insert-queue-before=first`. Untuk profil yang sudah terpasang, jalankan `/ppp profile set [find where name="UNZANET-INTERNET-1"] parent-queue=none insert-queue-before=first` sesuai nama profil Router/NAS sebenarnya; lalu sambungkan ulang hanya pelanggan yang diuji. Jangan menghapus queue yang masih menjadi referensi profil. Perubahan script tidak otomatis mengubah MikroTik yang sudah terpasang.

`npm run database:verify` memeriksa kolom dan index unik menggunakan koneksi database aplikasi secara read-only. Updater menjalankannya sebelum restart backend. Skema database lama tetap diperbarui manual sesuai panduan fitur; jangan impor ulang database.sql. Updater membangun backend ke staging dan hanya mengganti dist setelah compiler berhasil, sehingga kegagalan build tidak menghapus runtime sebelumnya.

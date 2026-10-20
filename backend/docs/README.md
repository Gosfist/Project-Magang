# Panduan arsitektur tanpa API MikroTik

Kolom Router/NAS kini Status VPN, berdasarkan sesi SSTP active dengan username dan
IP yang cocok di Accel-PPP, bukan isActive pendaftaran NAS. Sesi kosong berarti
Offline; data gagal/usang berarti Tidak diketahui; NAS lokal tampil Tanpa VPN.
Worker read-only unzanet-vpn-status.timer berjalan setiap 10 detik, web memuat
ulang setiap 15 detik. Installer/update memasangnya melalui setup-vpn-sync.sh.
Bagian 9.6 memuat pemeriksaan timer dan show sessions.

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
Login web, buat Klien VPN, tunggu penerapan sekitar 15 detik, pilih akun pada Router/NAS,
lalu pasang script MikroTik sederhana dalam tiga bagian dengan add langsung, tanpa :if.
Akun dan IP diambil otomatis. Gunakan sekali untuk pemasangan awal; pengulangan
dapat membuat entri ganda atau bentrok nama tunnel.
Nama interface SSTP, gateway rute, dan seluruh komentar memakai `UNZANET-RADIUS:VPN`.
Bagian 7 menjelaskan penggantian nama tunnel lama melalui Winbox tanpa paste ulang.
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
script add bukan pembaruan konfigurasi lama.
Bagian 9.5 memuat pemasangan template sederhana tanpa impor CA dan pilihan
update backend saja atau seluruh UI beserta paket frontend laptop.

Panduan instalasi lama sudah dihapus agar tidak ada alur yang saling bertentangan.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

Setiap kesalahan yang ditemukan saat instalasi atau operasi harus dikoreksi juga
pada panduan terkait. Untuk alur instalasi, perbarui [sumber Markdown](instalasi-ubuntu-vpn.md) dan
`install.doc` bersamaan, pertahankan langkah langsung per perangkat, lalu render
dan periksa setiap halaman Word sebelum commit/push. Perbaikan kode installer
harus disertai langkah pemulihan untuk konfigurasi lama bila diperlukan.

# PPPoE dengan FreeRADIUS tanpa API MikroTik

NestJS mengelola paket, pelanggan, billing, dan atribut RADIUS di database MySQL. MikroTik mengirim autentikasi UDP 1812 dan accounting UDP 1813. Backend mengirim Disconnect Request UDP 3799 setelah perubahan status/atribut berhasil disimpan. RFC 2865/2866 mengatur autentikasi dan accounting; RFC 5176 menggantikan RFC 3576 untuk Dynamic Authorization. Tidak ada login RouterOS API dan tidak ada polling SNMP.

## Instalasi dan pendaftaran NAS

Ikuti [panduan instalasi](instalasi-ubuntu-vpn.md): website, FreeRADIUS, dan SSTP berjalan pada satu VPS Ubuntu. Pasang aplikasi mode web, aktifkan HTTPS, lalu npm run setupvpnserver. Administrator membuat akun pada Klien VPN, menunggu Siap, kemudian memilihnya pada Router/NAS. IP, username/password VPN, dan CA masuk otomatis ke script MikroTik. Password VPN tersimpan terenkripsi di tabel klien; secret RADIUS tetap disimpan pada NAS. SSTP memakai TCP 4443 dan gateway RADIUS 10.88.0.1. Uji tunnel, PPPoE, accounting dan Disconnect secara nyata.

Aktifkan modul SQL pada authorize, accounting, session, dan post auth. Modul memakai `read_clients = yes`, tabel `nas`, dan query client dengan `WHERE is_active = 1`. Daftar client dibaca saat startup. Installer memasang worker root yang membandingkan fingerprint client setiap sekitar 60 detik, validasi `freeradius -XC`, lalu restart saat berubah. Worker tidak memberi sudo kepada web dan tidak mencetak secret.

Virtual server UNZANET memakai PAP, CHAP dan MS-CHAP untuk PPPoE. Installer menonaktifkan symlink modul EAP bawaan setelah mengganti site `default`/`inner-tunnel`; file `mods-available/eap` dipertahankan. Ini mencegah kegagalan `Failed to find 'Auth-Type EAP' section` dari modul yang aktif tanpa handler. File EAP custom yang bukan symlink tidak dihapus otomatis.

Client SSTP Ubuntu memakai opsi plugin `sstp-sock /run/sstpc/sstpc-sstp-radius`. Pada konfigurasi lama dengan salah tulis `sstp-socket`, perbaiki hanya nama opsi pada `/etc/ppp/peers/sstp-radius` lalu restart `sstp-radius`; kredensial dan database tidak perlu dibuat ulang. Jika tunnel tetap belum muncul, periksa `sudo journalctl -u sstp-radius -n 60 --no-pager` dan koneksi TCP 443 ke gateway. [Contoh konfigurasi resmi SSTP](https://gitlab.com/sstp-project/sstp-client/-/blob/master/sstp-test.example) menunjukkan opsi `sstp-sock` untuk plugin PPP.

Untuk instalasi manual, salin query MySQL bawaan melalui `scripts/installer-config.py queries --source PATH_QUERY_ASLI`, tinjau hasil, gunakan file terpisah `queries-unzanet.conf`, dan arahkan include modul SQL ke file itu. Akun SQL radius perlu SELECT pada radcheck/radreply/grup/nas/website_settings, SELECT/INSERT/UPDATE pada radacct/nasreload, serta SELECT/INSERT pada radpostauth. Akun itu tidak memerlukan hak DDL. Jalur update membantu memasang konfigurasi ini dan berhenti jika format custom tidak dikenali.

## Accounting dan satu sesi

Akun tetap memakai `Simultaneous-Use := 1`. Query session menghitung hanya accounting yang segar (awal 900 detik, cocok dengan Interim Update 5 menit). `simul_verify_query = ""` menonaktifkan verifikasi checkrad/SNMP. Kehilangan accounting berarti status tidak pasti; ketepatan pembatasan sesi bergantung pada Start/Stop/Interim Update yang benar.

Disconnect bertanda tangan yang mendapat ACK atau NAK 503 membuat penanda aplikasi per username/NAS/session ID pada website_settings. Query session mengecualikan masa sesi yang diakui sudah tidak ada, tanpa mengarang Accounting Stop. Penanda hanya berlaku jika waktu mulai sesi tidak lebih baru daripada ACK. Accounting tetap menyimpan bukti dari NAS.

Gunakan `RADIUS_ACCOUNTING_TIMEZONE=WIB` untuk query MySQL yang menyimpan DATETIME lokal Jakarta, seperti installer baru. Jika database accounting benar benar menyimpan UTC, isi UTC. Nilai ini berbeda dari timezone log post auth. `RADIUS_ACCOUNTING_STALE_SECONDS=900` mengatur batas backend; bila diubah, sesuaikan interval 900 detik pada simul_count_query agar penilaian SQL dan backend tetap selaras. Tolak timestamp jauh di masa depan dan pastikan NTP benar.

## Paket dan perangkat

Rate limit disimpan dari sisi pelanggan upload/download, lalu dikirim sebagai atribut MikroTik sesuai konvensi router. Framed-Pool mengacu nama pool yang harus benar benar tersedia pada NAS. IP Pool di web adalah metadata/rencana plus script pemasangan, bukan pembacaan RouterOS. PPPoE Server, profil dasar dengan local address, firewall dan NAT awal dipilih operator sesuai jaringan fisik.

Jangan membuat PPP secret lokal untuk username RADIUS yang sama: RouterOS mendahulukan akun lokal. Backup darurat lokal tetap berupa script unduhan yang dijalankan operator, tanpa koneksi API.

## Bukti pengujian

Uji login pelanggan dari dial PPPoE nyata, accounting Start/Interim/Stop, batas kecepatan, Putus Sesi, isolir pool, serta pemulihan sesudah ACC. Ping dan config check hanya membuktikan sebagian jalur. Tes lokal yang memakai socket UDP dan database tiruan belum membuktikan MikroTik nyata atau kapasitas produksi.

Sumber resmi: [MikroTik RADIUS](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS), [FreeRADIUS SQL](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-available/sql), [query MySQL](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/mysql/queries.conf), [RFC 5176](https://www.rfc-editor.org/rfc/rfc5176).

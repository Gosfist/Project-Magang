# Panduan arsitektur tanpa API MikroTik

Panduan aktif adalah [instalasi VPS Ubuntu](instalasi-ubuntu-vpn.md),
[FreeRADIUS](pppoe-freeradius.md), [operasi Router dan PPPoE](router-pppoe-operations.md),
[isolir](pppoe-isolation.md), dan [backup darurat](pppoe-backup.md).
Versi Word terbaru berada pada `install.doc` di root repo.
Bagian awal memuat panduan bergambar firewall DigitalOcean untuk pemula:
menu yang diklik, aturan 22/80/443/4443, Sources/Action, Outbound Rules,
Apply to Droplets, dan pemeriksaan hasil. Gambar ilustrasi serta satu screenshot
resmi berada di `images/`; sumber gambar dicantumkan pada panduan.
Urutan: siapkan VPS/DNS, build frontend di laptop, commit/push paket,
clone/pull VPS, `npm run install` mode `web`, HTTPS, lalu `npm run setupvpnserver`.
Website, RADIUS, dan VPN berada satu mesin; tidak perlu VPN client Ubuntu.
Login web, buat Klien VPN, tunggu Siap, pilih akun pada Router/NAS,
lalu pasang script MikroTik. Akun, IP, dan CA diambil otomatis.
SSTP memakai 4443; HTTPS website memakai 443.

Panduan instalasi lama sudah dihapus agar tidak ada alur yang saling bertentangan.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

Setiap kesalahan yang ditemukan saat instalasi atau operasi harus dikoreksi juga
pada panduan terkait. Untuk alur instalasi, perbarui [sumber Markdown](instalasi-ubuntu-vpn.md) dan
`install.doc` bersamaan, pertahankan langkah langsung per perangkat, lalu render
dan periksa setiap halaman Word sebelum commit/push. Perbaikan kode installer
harus disertai langkah pemulihan untuk konfigurasi lama bila diperlukan.

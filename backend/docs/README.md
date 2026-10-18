# Panduan arsitektur tanpa API MikroTik

Panduan aktif adalah [instalasi Ubuntu dan VirtualBox](instalasi-ubuntu-vpn.md),
[FreeRADIUS](pppoe-freeradius.md), [operasi Router dan PPPoE](router-pppoe-operations.md),
[isolir](pppoe-isolation.md), dan [backup darurat](pppoe-backup.md).
Versi Word terbaru berada pada `install.doc` di root repo.
Urutan instalasi: Ubuntu VirtualBox DHCP/NAT, aktifkan SSH, remote dari CMD,
build frontend di laptop dengan `npm.cmd run preparefe`, commit dan push
`releases/frontend.tar.gz` ke GitHub, clone repo beserta paket di Ubuntu,
`npm run install` (mode `web`, tanpa build frontend di server),
setup VPN Ubuntu dengan `npm run setupvpn`,
buka website dan uji login, lalu tambah NAS untuk memperoleh satu script
VPN/RADIUS MikroTik. Isi CA publik PEM pada form untuk impor CA dalam script
yang sama. IP LAN tertentu dan jaringan fisik yang sama tidak diperlukan.

Panduan instalasi lama sudah dihapus agar tidak ada alur yang saling bertentangan.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

Setiap kesalahan yang ditemukan saat instalasi atau operasi harus dikoreksi juga
pada panduan terkait. Untuk alur instalasi, perbarui [sumber Markdown](instalasi-ubuntu-vpn.md) dan
`install.doc` bersamaan, pertahankan langkah langsung per perangkat, lalu render
dan periksa setiap halaman Word sebelum commit/push. Perbaikan kode installer
harus disertai langkah pemulihan untuk konfigurasi lama bila diperlukan.

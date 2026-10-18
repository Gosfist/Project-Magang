# Panduan arsitektur tanpa API MikroTik

Panduan aktif adalah [instalasi Ubuntu dan VirtualBox](instalasi-ubuntu-vpn.md),
[FreeRADIUS](pppoe-freeradius.md), [operasi Router dan PPPoE](router-pppoe-operations.md),
[isolir](pppoe-isolation.md), dan [backup darurat](pppoe-backup.md).
Versi Word terbaru berada pada `install.doc` di root repo.
Urutan instalasi: Ubuntu VirtualBox DHCP/NAT, aktifkan SSH, remote dari CMD,
`npm run install` (mode `web`), setup VPN Ubuntu dengan `npm run setupvpn`,
buka website dan uji login, lalu tambah NAS untuk memperoleh satu script
VPN/RADIUS MikroTik. Isi CA publik PEM pada form untuk impor CA dalam script
yang sama. IP LAN tertentu dan jaringan fisik yang sama tidak diperlukan.

Panduan instalasi lama sudah dihapus agar tidak ada alur yang saling bertentangan.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

# Panduan arsitektur tanpa API MikroTik

Panduan aktif adalah [instalasi Ubuntu dan VirtualBox](instalasi-ubuntu-vpn.md),
[FreeRADIUS](pppoe-freeradius.md), [operasi Router dan PPPoE](router-pppoe-operations.md),
[isolir](pppoe-isolation.md), dan [backup darurat](pppoe-backup.md).
Versi Word terbaru berada pada `install.doc` di root repo.
Instalasi dimulai dengan internet DHCP/NAT dan website sampai berhasil login
(mode `web`). Setelah itu jalankan `npm run setupvpn`, tambah NAS, pasang script
MikroTik, dan uji ping melalui tunnel. IP LAN tertentu dan jaringan fisik yang
sama dengan MikroTik tidak diperlukan.

Dokumen `Panduan_Setup_Lab_PPPoE_VirtualBox.docx` dan
`Panduan_Setup_Lab_PPPoE_VirtualBox_v1.1_WireGuard.docx` adalah arsip arsitektur
sebelum revisi tanpa API. Gunakan panduan aktif untuk instalasi baru.
Generator `backend/scripts/generate_pppoe_virtualbox_guide.py` kini membaca sumber
Markdown aktif dan menghasilkan `install.docx`, bukan mereproduksi panduan lama.

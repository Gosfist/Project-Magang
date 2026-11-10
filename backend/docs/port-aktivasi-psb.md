# Pilihan port aktivasi PSB

Aktivasi menampilkan semua port keluaran dari splitter ODC/ODP terpilih. Port yang terhubung ke titik Main Core atau pelanggan lain diberi label `(terpakai)` dan tidak dapat dipilih. Pelanggan nonaktif tetap memakai port fisiknya sampai dipindah atau dihapus. Saat mengedit aktivasi, port milik akun yang sama tetap dapat dipilih. Mengganti ODC/ODP mengosongkan pilihan port.

Nomor port disimpan pada `daftar_pelanggan.odp_port`. Akun pelanggan menjadi sumber data port untuk PSB. Backend mengunci baris titik sumber selama pemeriksaan dan penyimpanan; index unik mencegah dua pelanggan memakai port yang sama. Pembuatan/pemindahan jalur Main Core juga memeriksa pemakaian pelanggan. Nomor port ini adalah port fisik splitter, bukan port TCP/UDP atau NAS-Port RADIUS.

## Database yang sudah terpasang

Lakukan pembaruan skema sebelum menjalankan backend terbaru. `npm run update` tidak mengubah skema database. Jangan mengimpor ulang `database.sql` ke database yang sudah berisi data.

Periksa dahulu pada MySQL database aplikasi:

```sql
SHOW COLUMNS FROM daftar_pelanggan LIKE 'odp_port';
SHOW INDEX FROM daftar_pelanggan WHERE Key_name = 'daftar_pelanggan_odp_port_key';
```

Jika kolom belum ada, jalankan sekali:

```sql
ALTER TABLE daftar_pelanggan ADD COLUMN odp_port INT UNSIGNED NULL AFTER odp;
```

Jika index belum ada, jalankan sekali:

```sql
ALTER TABLE daftar_pelanggan ADD UNIQUE INDEX daftar_pelanggan_odp_port_key (odp, odp_port);
```

Pelanggan lama tetap bernilai NULL; port fisiknya perlu ditetapkan manual melalui edit aktivasi PSB atau Data Pelanggan > Akun PPPoE. Area ODC/ODP pada form pelanggan dibagi dua kolom, dengan Port di sebelah kanan. Sistem tidak menebak port pelanggan lama. Setelah skema siap, deploy backend dan frontend bersama. Instalasi database kosong menggunakan `backend/prisma/database.sql` terbaru yang sudah memuat kolom dan index ini.

## Pemeriksaan

Coba port kosong, port terpakai pelanggan, dan port terpakai jalur Main Core. Edit pelanggan pada portnya sendiri, pindahkan lokasi, lalu pastikan port lama kembali kosong. Coba dua aktivasi bersamaan pada port yang sama: salah satunya harus ditolak. Uji database nyata dan alur aktivasi pada VPS tetap diperlukan setelah deployment.

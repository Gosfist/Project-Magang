# Nomor pelanggan PPPoE

Nomor tampilan berasal dari `customer_number`, diformat minimal enam digit. Saat menambah pelanggan, aplikasi mengambil `MAX(customer_number) + 1` dari pelanggan yang masih ada, mulai 1 untuk tabel kosong. Menghapus nomor di tengah tidak mengisi celah tersebut; menghapus nomor terbesar memungkinkan nomornya digunakan kembali. ID primary key tetap auto-increment dan tidak direset, sehingga relasi invoice/API tetap memakai identitas akun asli.

Pembuatan akun, nomor, invoice, dan data RADIUS memakai satu transaksi Serializable. Konflik transaksi/nomor dicoba ulang maksimal lima kali, dengan unique index sebagai pengaman.

## Instalasi database

Kolom `customer_number` dan unique index sudah tercakup dalam [`../prisma/database.sql`](../prisma/database.sql). Pada instalasi baru, impor file tersebut sekali ke database kosong, lalu jalankan `npm run prisma:generate` dan `npm run db:seed` dari folder backend. Ikuti [panduan instalasi database](../../README.md#database).

File pembaruan bertahap sudah dihapus. Impor SQL lengkap ini bukan langkah upgrade database lama yang berisi pelanggan; database lama memerlukan peninjauan dan backfill nomor tersendiri agar identitas pelanggan tetap terjaga.

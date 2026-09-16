# Nomor pelanggan PPPoE

Nomor tampilan berasal dari `customer_number`, diformat minimal enam digit. Saat menambah pelanggan, aplikasi mengambil `MAX(customer_number) + 1` dari pelanggan yang masih ada, mulai 1 untuk tabel kosong. Menghapus nomor di tengah tidak mengisi celah tersebut; menghapus nomor terbesar memungkinkan nomornya digunakan kembali. ID primary key tetap auto-increment dan tidak direset, sehingga relasi invoice/API tetap memakai identitas akun asli.

Pembuatan akun, nomor, invoice, dan data RADIUS memakai satu transaksi Serializable. Konflik transaksi/nomor dicoba ulang maksimal lima kali, dengan unique index sebagai pengaman.

## Update database yang sudah berisi data

Hentikan penulisan akun (service backend) dan simpan backup database sebelum menjalankan `prisma/updates/20260917_customer_number.sql` **satu kali**. SQL menambahkan kolom, mengisi nomor akun lama dari ID saat ini agar nomor tampilan lama tetap sama, lalu menambahkan unique index. Jangan memakai `db:push` sebagai pengganti backfill untuk database lama.

Contoh di Ubuntu dengan database `unzanet`, dari folder backend:

```bash
sudo systemctl stop unzanet-backend
sudo mysqldump --single-transaction unzanet > "$HOME/unzanet-before-customer-number-$(date +%Y%m%d-%H%M%S).sql"
sudo mysql unzanet < prisma/updates/20260917_customer_number.sql
npm run prisma:generate
npm run build
sudo systemctl start unzanet-backend
```

Jalankan perintah satu per satu; jangan lanjut bila backup, SQL, atau build gagal. Sesuaikan user MySQL/database bila berbeda. Update SQL ini tidak dijalankan otomatis oleh build.

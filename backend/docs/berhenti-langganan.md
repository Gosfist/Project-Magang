# Berhenti Langganan dan isolir manual

Menu **Teknisi -> Berhenti Langganan** dapat dibuka administrator dan seluruh teknisi.
Default filter **Belum diambil**. Filter **Selesai / Sudah diambil** memperlihatkan
nama petugas dan waktu pengambilan, tanpa pembatasan berdasarkan teknisi pengaju/pengambil.

1. Administrator memilih Tambah, mengetik nama/nomor pelanggan, lalu memilih hasil dropdown yang muncul langsung di bawah input dan mengisi alasan. Pelanggan yang sudah berhenti atau sudah masuk daftar penghentian tidak ditawarkan, termasuk yang perangkatnya belum diambil.
2. Pelanggan tampil berkategori **Berhenti Langganan** di Data Pelanggan. Langganan dan penagihan langsung dihentikan pada tanggal permintaan disimpan, akses RADIUS dinonaktifkan, dan tagihan akhir dibentuk sampai tanggal tersebut.
3. **Isolir manual** tetap tersedia di Edit Data Pelanggan -> Akun PPPoE untuk pelanggan yang belum dihentikan. Penghentian dari menu ini langsung menutup layanan dan tidak memerlukan centang isolir manual. Pembayaran dan janji bayar tidak melepas isolir ini. Menghapus centang membuka isolir manual serta menghapus tanggal kedaluwarsa lama; auto isolir karena tunggakan tetap dapat berlaku pada pemeriksaan berikutnya.
4. Administrator atau teknisi mengambil perangkat, lalu memilih **Selesai**. Dialog menampilkan tagihan yang harus diterima. Centang konfirmasi setelah perangkat dan pembayaran benar-benar diterima.
5. Penyelesaian menyimpan nama akun petugas yang login, tanggal pengambilan, nominal pembayaran, melepaskan port pelanggan, tanpa mengubah tanggal berhenti atau menambah biaya selama menunggu perangkat diambil. Lokasi lama, KTP, foto, registrasi, invoice, setoran dan log tetap disimpan.
6. Pembayaran akhir dibuat sebagai setoran **PENDING** atas nama petugas dan masuk **Finance -> Setoran Kolektor** untuk ACC. Nol rupiah tidak membuat setoran kosong. ACC, janji bayar, edit PSB dan impor tidak mengaktifkan kembali pelanggan yang telah berhenti. Pembatalan hanya dapat dilakukan melalui aksi Batal khusus admin sebelum pengambilan perangkat selesai.
7. Sesudah Tambah berhasil disimpan, sistem mengirim WA persetujuan penghentian: teknisi akan berkunjung untuk mengambil perangkat, tanggal berhenti, tagihan prorata bulan berjalan yang masih harus dibayar, tunggakan/biaya lain, dan total sisa pembayaran. Jumlah dikurangi pembayaran/setoran yang sudah tercatat. Kegagalan WA tidak membatalkan penghentian; respons menampilkan peringatan. Administrator dapat memilih **Kirim WA** di daftar Belum diambil untuk mencoba lagi atau mengirim persetujuan bagi data lama yang belum menerima WA, tanpa menambah permintaan atau tagihan baru.
8. Setelah Selesai, WhatsApp memberi tahu bahwa perangkat diambil, nama petugas, langganan dihentikan dan pembayaran akhir diterima. Kegagalan bot tidak membatalkan penyelesaian. Pada daftar Selesai, gunakan **Kirim ulang WA** jika belum terkirim. Jangan mengulangi pencatatan pembayaran.

## Perhitungan pembayaran

Tanggal layanan mengikuti zona penagihan WIB/WITA/WIT. Untuk pascabayar, biaya
periode yang belum ditagih dihitung dengan harga paket bersih diskon saat
admin menyimpan permintaan dikalikan jumlah hari layanan / jumlah hari dalam bulan, dibulatkan ke rupiah.
Tanggal aktivasi dan tanggal admin menyimpan permintaan sama-sama dihitung. Bulan penuh yang
belum ditagih dihitung penuh. Semua periode sejak tanggal aktivasi diperiksa,
termasuk periode yang belum sempat dibuat scheduler. Invoice yang sudah ada tetap
menggunakan nominal tersimpan; sistem tidak mengganti riwayat harga/pembayaran.
Prabayar tidak membuat prorata layanan baru; invoice yang belum lunas tetap ditampilkan.

Contoh: aktivasi 11 November dan admin menyimpan penghentian 13 November dengan harga bersih
Rp300.000 menghasilkan 3/30 x Rp300.000 = **Rp30.000**, ditambah tunggakan lain. Jika perangkat baru diambil pada Januari, prorata tetap berakhir 13 November.
Invoice lunas tidak ditagih ulang. Setoran PENDING/ACCEPTED yang sudah tercatat
dikurangkan dari pembayaran yang perlu diterima petugas. Setoran yang ditolak
atau dibatalkan tetap menjadi kewajiban sesuai status invoice.

Ringkasan dihitung ulang di transaksi penyelesaian. Jika nominal berubah atau
petugas lain sudah menyelesaikan, permintaan ditolak; buka ulang ringkasan.
Sejak admin menyimpan permintaan tidak dibuat tagihan langganan bulanan baru, meskipun pengambilan perangkat tertunda beberapa hari, minggu atau bulan. Tunggakan yang
kemudian dikoreksi/ditolak finance tetap tercatat, tetapi tidak membuka layanan.

## Identitas permanen

Tombol, API DELETE, dan service penghapusan pelanggan/registrasi PSB sudah dicabut.
Nomor KTP yang telah didaftarkan tidak dapat diganti, dikosongkan, atau didaftarkan
ulang lewat akun lain, termasuk setelah berhenti. Impor backup tidak mengganti KTP
terdaftar dan menolak pembaruan akun yang sudah berhenti. Foto/log tidak dihapus
oleh alur penghentian. Script backup lokal baru hanya memuat akun yang belum
berhenti. Script backup lama yang pernah diunduh perlu diganti; perubahan web
tidak menjalankan perubahan pada secrets lokal RouterOS yang sudah terpasang.

## Skema dan penerapan

Instalasi kosong menggunakan `backend/prisma/database.sql` yang dihasilkan dari
Prisma schema. **Jangan impor file lengkap tersebut ke database berisi data.**
Updater aplikasi tidak otomatis mengubah skema database.

Database lama memerlukan dua kolom dan tabel berikut sebelum backend terbaru
dijalankan. Cadangkan database, verifikasi struktur yang sekarang, dan jalankan
perubahan tambahan ini sekali bila struktur tersebut belum ada. Tidak ada DROP,
TRUNCATE, perubahan KTP, atau penghapusan data dalam perubahan ini.

```sql
ALTER TABLE `daftar_pelanggan`
 ADD COLUMN `manual_isolated` BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN `terminated_at` DATETIME(3) NULL;

CREATE TABLE `subscription_terminations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pppoe_account_id` BIGINT UNSIGNED NOT NULL,
    `requested_by_user_id` BIGINT UNSIGNED NOT NULL,
    `collected_by_user_id` BIGINT UNSIGNED NULL,
    `requested_by_name` VARCHAR(255) NOT NULL,
    `collected_by_name` VARCHAR(255) NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `collected_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `wa_sent_at` DATETIME(3) NULL,

    INDEX `subscription_terminations_pppoe_account_id_idx`(`pppoe_account_id`),
    INDEX `subscription_terminations_status_requested_at_idx`(`status`, `requested_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_pppoe_account_id_fkey` FOREIGN KEY (`pppoe_account_id`) REFERENCES `daftar_pelanggan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subscription_terminations` ADD CONSTRAINT `subscription_terminations_collected_by_user_id_fkey` FOREIGN KEY (`collected_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

Setelah skema siap, generate Prisma Client dan build backend/frontend seperti
alur update proyek. Tidak ada akses atau perubahan database produksi pada
implementasi lokal fitur ini. Validasi lokal tidak membuktikan pengiriman WA,
Disconnect RADIUS atau pengambilan perangkat sungguhan.

## Template pesan WhatsApp

Bot WhatsApp > Template Pesan menyediakan **Berhenti Langganan** (`termination_approved`)
dan **Perangkat Diambil** (`termination_completed`). Keduanya bisa diedit, disimpan,
dan dipratinjau dengan contoh data. Template tersimpan di `website_settings` menggunakan
key `wa_template_termination_approved` / `wa_template_termination_completed`;
tidak memerlukan perubahan skema database baru.

Persetujuan mendukung `{nama}`, `{nomor_pelanggan}`, `{paket}`, `{tanggal_berhenti}`,
`{prorata}`, `{tunggakan}`, `{total_tagihan}`. Prorata adalah sisa tagihan layanan
bulan berjalan sampai tanggal berhenti; tunggakan/biaya lainnya adalah sisa invoice
lain. Nominal ini tetap memakai invoice yang dibentuk saat admin menambahkan penghentian,
bukan bertambah selama menunggu pengambilan. Pengiriman ulang menyesuaikan sisa
pembayaran yang masih perlu diterima, tanpa mengubah nominal invoice.

Pengambilan selesai mendukung `{nama}`, `{nomor_pelanggan}`, `{nama_petugas}`,
`{tanggal_berhenti}`, `{jumlah}`. Bila template belum disimpan, backend dan bot
menyediakan template bawaan yang sesuai. Penerapan perubahan ini memerlukan update
backend, frontend dan bot Go agar editor dan API template sama-sama mengenali key baru.

## Pembatalan khusus admin

Pada filter **Belum diambil**, administrator dapat memilih **Batal**, membaca
konfirmasi, mengisi alasan dan menekan **Batalkan penghentian**. Teknisi tidak
memiliki tombol atau akses API pembatalan. Permintaan yang sudah Selesai atau
sudah dibatalkan tidak dapat dibatalkan lagi.

Pembatalan memperlakukan penghentian sebagai koreksi: langganan dan tagihan normal
kembali berlaku termasuk periode selama menunggu perangkat diambil. Invoice akhir
prorata yang belum memiliki pembayaran/setoran disesuaikan menjadi tagihan normal
sampai akhir bulan. Periode terlewat dibentuk tanpa menggandakan nomor invoice.
Invoice yang sudah dibayar atau mempunyai setoran tetap dipertahankan; kekurangan
nominal menjadi invoice tambahan. Tidak ada penghapusan atau penimpaan uang yang
sudah diterima. Status nonaktif, tanggal kedaluwarsa, dan isolir manual sebelumnya
tetap berlaku; pembatalan tidak otomatis melunasi tunggakan. Janji bayar sebelumnya dipulihkan dengan tenggat yang sama; jika sudah lewat, akses tetap diisolir.

Riwayat permintaan tetap ada dengan status `CANCELLED`, alasan dan nama admin
pembatal tercatat di log aktivitas serta `website_settings` dengan key
`termination_cancel_{id}`. Snapshot sebelum penghentian disimpan pada
`termination_original_{id}`. Untuk permintaan lama tanpa snapshot, pembatalan
mempertahankan isolir manual/tanggal kedaluwarsa saat ini. Akun, nomor pelanggan,
KTP, foto dan riwayat pembayaran tetap disimpan. Pelanggan yang sudah dibatalkan
kembali tersedia pada pencarian Tambah dan bisa mempunyai permintaan baru dengan
ID berbeda; permintaan lama tidak ditimpa atau dihapus.

### Tambahan satu kali untuk database VPS lama

Relasi permintaan berubah menjadi satu pelanggan dengan banyak riwayat. Pada
database lama yang sudah memiliki tabel `subscription_terminations`, jalankan
SQL berikut **sekali**, sebelum update backend terbaru. Tambah index biasa dulu
agar foreign key tetap memiliki index saat index unik lama dilepas.

```sql
ALTER TABLE `subscription_terminations`
 ADD INDEX `subscription_terminations_pppoe_account_id_idx` (`pppoe_account_id`);
ALTER TABLE `subscription_terminations`
 DROP INDEX `subscription_terminations_pppoe_account_id_key`;
```

Perubahan ini tidak menghapus baris dan tidak menghapus foreign key. Jangan impor
ulang `database.sql`. Instalasi kosong sudah memakai index biasa dari schema
terbaru. `database:verify` menolak index unik lama agar pengajuan ulang tidak
baru gagal saat pelanggan mencoba berhenti lagi.

# Router dan PPPoE

## Form pelanggan dan foto KTP

Tambah akun tetap memakai tiga tahap. Seluruh data pelanggan (nama, telepon, nomor/foto KTP, koordinat, alamat) wajib terisi sebelum lanjut. Foto diunggah melalui `POST /api/pppoe/id-card-photo` menggunakan multipart field `file`; hanya JPG, PNG, atau WebP maksimal 5 MB. Endpoint membutuhkan login. File disimpan di `backend/storage/id-cards`, di luar folder statis publik, dan referensinya disimpan pada `idCardPhoto`. Folder storage harus dapat ditulis oleh user service backend dan ikut backup; tidak ada migrasi database baru.

Jika memakai Nginx, atur `client_max_body_size 6m;` di blok server atau location `/api/` agar upload 5 MB beserta multipart envelope bisa diterima. Jalankan `sudo nginx -t` sebelum reload Nginx.

Edit akun memakai satu form Data Pelanggan dan Akun PPPoE tanpa tahap pembayaran. Nilai pembayaran serta catatan lama tetap dikirim dari data akun; edit tidak membuat invoice baru. ODP wajib dipilih dan harus merujuk titik bertipe `odp` yang masih tersedia. Catatan tidak ditampilkan pada form tambah/edit.

## Tes Router

`POST /api/router/nas/:id/test` melakukan login API menggunakan kredensial NAS yang tersimpan, lalu membaca `/system/identity/print`. Port terbuka dengan password salah menghasilkan `success: false`. Koneksi memiliki batas waktu 15 detik dan socket selalu ditutup. RouterOS 6.43+ didukung; respons kosong RouterOS 7.18 (`!empty`) ditangani.

API biasa menggunakan port 8728. Port 8729 menggunakan TLS dengan verifikasi sertifikat bawaan Node; CA privat dapat diberikan melalui `NODE_EXTRA_CA_CERTS` saat menjalankan backend. Implementasi protokol mengikuti [dokumentasi API MikroTik](https://help.mikrotik.com/docs/spaces/ROS/pages/47579160/API).

## IP Pool

Daftar pool dibaca langsung melalui `/ip/pool/print` pada NAS aktif. Tambah pool meminta Router/NAS tujuan dan menjalankan `/ip/pool/add`; edit dan hapus menggunakan `.id` MikroTik pada router tersebut. Tidak ada penyimpanan konfigurasi pool baru ke tabel `ip_pools` atau langkah Sinkronkan. Kegagalan API membuat operasi gagal, bukan dilaporkan sebagai berhasil.

Paket menyimpan nama pool pada `addressPool` untuk atribut RADIUS `Framed-Pool`. Pool bernama sama harus tersedia pada setiap MikroTik yang melayani paket tersebut. Relasi dan data pool lama dipertahankan untuk kompatibilitas paket lama; pool yang hanya ada di database tidak tampil pada daftar perangkat. Buat melalui aplikasi jika belum ada di router. Nama atau penghapusan pool yang dipakai paket diblokir.

Rentang IPv4 awal/akhir divalidasi. Rentang kompleks dari MikroTik tetap ditampilkan utuh; form edit hanya mendukung satu rentang IPv4. Router yang gagal dibaca ditampilkan sebagai peringatan, sehingga daftar mungkin tidak lengkap. Pengaturan Router/NAS tetap menyimpan koneksi API dalam database.

## Menonaktifkan pelanggan

Perubahan akun dan data RADIUS diselesaikan dahulu, kemudian sesi username lama dicari di `/ppp/active` dan dihapus berdasarkan `.id`. Target mencakup NAS pelanggan dan NAS yang tercatat di sesi `radacct`. Tanpa keduanya, seluruh NAS aktif diperiksa berdasarkan username persis. NAS accounting yang tidak terdaftar menghasilkan peringatan. Menonaktifkan paket juga memutus sesi akun pada paket tersebut.

Kegagalan perangkat tidak membatalkan status nonaktif yang sudah disimpan. UI menampilkan peringatan dan menyediakan tombol **Putus Sesi** (`POST /api/pppoe/accounts/:id/disconnect`) untuk mencoba ulang. Akun yang masih aktif dapat terhubung kembali setelah pemutusan manual. Aplikasi tidak mengarang `Accounting-Stop`; pembaruan accounting tetap berasal dari router/FreeRADIUS. Tidak ada penjadwal retry otomatis.

## Tagihan pertama

- `none`: tidak membuat tagihan pertama.
- `full`: harga paket penuh setelah diskon.
- `prorate`: prorata untuk POSTPAID; PREPAID tetap harga penuh, termasuk jika dikirim oleh frontend lama.
- Frontend mengirim `full` untuk pelanggan PREPAID baru. Edit pelanggan tidak membuat invoice baru.

Ini mengikuti perlakuan PREPAID pada `backend/src/server/services/pppoe.service.ts` dalam referensi. Pengujian mencakup server TCP lokal yang meniru protokol RouterOS dan mock database; perangkat MikroTik dan FreeRADIUS langsung belum diuji.

### Penggunaan IP Pool

Halaman IP Pool menampilkan Total IP, IP Terpakai, dan IP Tersedia dengan tombol Refresh. Penggunaan dibaca dari `/ip/pool/used/print` per router, dicocokkan dengan nama atau ID pool, dan dihitung sebagai alamat unik dalam rentang pool. Total mencakup kedua ujung rentang, mendukung beberapa rentang dan alamat tunggal tanpa menghitung ganda rentang tumpang tindih. Alokasi layanan lain pada pool yang sama ikut dihitung. Kapasitas next-pool tidak digabungkan. IP statis di luar mekanisme alokasi pool tidak dilacak oleh tabel ini.

Kegagalan membaca penggunaan menghasilkan peringatan dan nilai null (ditampilkan sebagai tanda ?), bukan nol. Format rentang yang tidak didukung juga ditampilkan sebagai ?. Tidak ada perubahan database. Acuan: https://help.mikrotik.com/docs/spaces/ROS/pages/129531938/IP+Pools

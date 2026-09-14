# Router dan PPPoE

## Tes Router

`POST /api/router/nas/:id/test` melakukan login API menggunakan kredensial NAS yang tersimpan, lalu membaca `/system/identity/print`. Port terbuka dengan password salah menghasilkan `success: false`. Koneksi memiliki batas waktu 15 detik dan socket selalu ditutup. RouterOS 6.43+ didukung; respons kosong RouterOS 7.18 (`!empty`) ditangani.

API biasa menggunakan port 8728. Port 8729 menggunakan TLS dengan verifikasi sertifikat bawaan Node; CA privat dapat diberikan melalui `NODE_EXTRA_CA_CERTS` saat menjalankan backend. Implementasi protokol mengikuti [dokumentasi API MikroTik](https://help.mikrotik.com/docs/spaces/ROS/pages/47579160/API).

## IP Pool

Menyimpan atau mengedit pool otomatis membuat/memperbarui `/ip/pool` di seluruh NAS aktif, karena pool dalam schema aplikasi ini bersifat global. Nama pool MikroTik sama dengan atribut `Framed-Pool`. Operasi menggunakan API terstruktur, bukan skrip shell. Rentang IPv4 divalidasi. Pool yang sedang dipakai paket tidak dapat diganti namanya; buat pool baru lalu pindahkan paket.

Data database tetap tersimpan ketika suatu NAS tidak terjangkau. Respons mengandung `warnings` dan UI menampilkan pesan kegagalan. Tombol **Sinkronkan** (`POST /api/pppoe/ip-pools/:id/sync`) dapat dipakai setelah memperbaiki koneksi atau menambahkan NAS baru. Sinkronisasi ulang tidak menduplikasi pool. Penghapusan data pool dari aplikasi tidak menghapus pool perangkat secara otomatis.

Perbedaan dengan referensi Salfanet: menu IP Pool referensi mengelola `radippool` untuk alokasi oleh FreeRADIUS. Perubahan ini memenuhi kebutuhan sinkronisasi MikroTik pada arsitektur `Framed-Pool` aplikasi yang sudah ada; tidak mengubahnya menjadi `sqlippool`.

## Menonaktifkan pelanggan

Perubahan akun dan data RADIUS diselesaikan dahulu, kemudian sesi username lama dicari di `/ppp/active` dan dihapus berdasarkan `.id`. Target mencakup NAS pelanggan dan NAS yang tercatat di sesi `radacct`. Tanpa keduanya, seluruh NAS aktif diperiksa berdasarkan username persis. NAS accounting yang tidak terdaftar menghasilkan peringatan. Menonaktifkan paket juga memutus sesi akun pada paket tersebut.

Kegagalan perangkat tidak membatalkan status nonaktif yang sudah disimpan. UI menampilkan peringatan dan menyediakan tombol **Putus Sesi** (`POST /api/pppoe/accounts/:id/disconnect`) untuk mencoba ulang. Akun yang masih aktif dapat terhubung kembali setelah pemutusan manual. Aplikasi tidak mengarang `Accounting-Stop`; pembaruan accounting tetap berasal dari router/FreeRADIUS. Tidak ada penjadwal retry otomatis.

## Tagihan pertama

- `none`: tidak membuat tagihan pertama.
- `full`: harga paket penuh setelah diskon.
- `prorate`: prorata untuk POSTPAID; PREPAID tetap harga penuh, termasuk jika dikirim oleh frontend lama.
- Frontend mengirim `full` untuk pelanggan PREPAID baru. Edit pelanggan tidak membuat invoice baru.

Ini mengikuti perlakuan PREPAID pada `backend/src/server/services/pppoe.service.ts` dalam referensi. Pengujian mencakup server TCP lokal yang meniru protokol RouterOS dan mock database; perangkat MikroTik dan FreeRADIUS langsung belum diuji.

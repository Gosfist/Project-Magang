# Audit logika aplikasi — 11 November 2026

Audit dilakukan pada checkout lokal dengan baseline `d332339`, menggunakan Node.js 26.13.0. Temuan di bawah diperbaiki pada working tree. Tidak ada perubahan database produksi, deployment VPS, pemutusan sesi pelanggan, atau perubahan konfigurasi MikroTik dalam audit ini.

## Hasil dan cakupan

Ada bug tambahan yang ditemukan. Audit ini meninjau alur pelanggan/PSB, port dan topologi Main Core, paket dan atribut RADIUS, accounting/uptime, tagihan/isolir, setoran/pembayaran, pembatasan akses, foto privat, bot WhatsApp, serta skrip build/update. Seluruh suite tes lokal yang tersedia dijalankan, dengan tes regresi tambahan untuk temuan utama.

Hasil ini bukan jaminan seluruh kemungkinan bug sudah habis. Tes menggunakan fixture/mock pada batas database, RouterOS, RADIUS dan WhatsApp. Pengujian integrasi dengan MySQL dan perangkat nyata tetap diperlukan, terutama transaksi bersamaan dan siklus PPPoE/isolir/pembayaran.

## Temuan yang diperbaiki

| Prioritas | Pemicu dan dampak sebelumnya | Perbaikan dan bukti lokal |
| --- | --- | --- |
| Tinggi | Dua permintaan ACC membaca setoran PENDING yang sama sebelum transaksi; pencatatan pemasukan dapat diproses dua kali. Tolak/Batal ACC/Hapus juga dapat memakai status lama. | Perubahan status memakai kondisi status saat ini secara atomik dan memeriksa jumlah baris. Pembayaran invoice juga harus masih PENDING/OVERDUE. Tes permintaan ACC bersamaan menghasilkan satu pemasukan; tes perubahan status lain menolak status yang sudah berubah. |
| Tinggi | Dua kolektor membuat setoran untuk invoice sama sebelum salah satunya menyimpan; pemeriksaan duplikasi berada di luar transaksi. | Kunci baris invoice dengan `SELECT ... FOR UPDATE`, lalu periksa dan buat setoran dalam transaksi yang sama. Tes fixture memeriksa dua permintaan pada satu invoice. |
| Tinggi | Scheduler mengambil calon isolir, lalu pembayaran/janji bayar berubah sebelum transaksi. Kode lama tetap menonaktifkan akun dari daftar yang sudah kedaluwarsa. Invoice OVERDUE juga tidak ikut pencarian isolir. | Periksa kelayakan pada UPDATE bersyarat dalam transaksi Serializable: akun/paket aktif, masih ada invoice PENDING/OVERDUE jatuh tempo, dan tidak ada janji bayar aktif. Jika tidak lagi memenuhi syarat, jangan sinkronisasi isolir, Disconnect, atau kirim notifikasi isolir. Dua kasus regresi membuktikan kandidat kedaluwarsa dilewati dan kandidat valid tetap diproses. |
| Tinggi | Pembuatan invoice selalu mengambil 500 pelanggan pertama. Pelanggan berikutnya tidak mendapat invoice meski scheduler berulang. | Pagination berdasarkan ID sampai batch terakhir, tetap mempertahankan pembatas satu pelanggan untuk simulasi. Tes 501 pelanggan memastikan invoice pelanggan ke-501 dibuat. |
| Sedang | Paket dinonaktifkan lalu diaktifkan kembali memperbarui database/RADIUS tetapi sesi lama dapat tetap memakai profil isolir. | Minta autentikasi ulang pelanggan setelah commit pada kedua perubahan status. Kegagalan Disconnect dikembalikan sebagai warning. Tes aktivasi ulang paket menuntut Disconnect. |
| Tinggi | Main Core dapat dipindah ke turunannya sehingga membentuk siklus; splitter dapat diperkecil meski titik anak masih memakai port yang dihapus. | Validasi rantai parent dan seluruh pemakaian port anak/pelanggan. Tes siklus dan penyusutan kapasitas gagal sebelum perbaikan, lalu lulus. |
| Sedang | Daftar sumber menghitung anak saja sehingga sumber penuh oleh pelanggan masih ditawarkan; penghapusan titik belum memakai lock yang sama dengan pemilihan port. | Kapasitas menghitung gabungan port anak dan pelanggan. Penghapusan mengunci titik sebelum memeriksa relasi. Penyimpanan lokasi pelanggan tanpa port legacy juga mengunci titik. |
| Tinggi | Foto instalasi ditulis ke nama file yang sama sebelum transaksi selesai; rollback dapat meninggalkan foto lama yang tertimpa. Referensi foto lain dapat dikirim oleh klien. | Nama file baru unik, penulisan dilakukan setelah validasi port, file baru dibersihkan jika transaksi gagal, dan referensi non-upload harus sama dengan foto pesanan tersebut. Tes filesystem memastikan foto lama tetap utuh dan file baru dibersihkan saat rollback. |
| Sedang | Respons foto pelanggan A datang setelah membuka pelanggan B, sehingga preview dapat menampilkan foto yang salah. Error port dari ApiService juga sudah berupa Error biasa tetapi UI membaca format HttpErrorResponse. | Respons foto dan FileReader lama diabaikan dengan nomor permintaan; referensi foto yang tidak berubah dipertahankan. Error port membaca `message` yang dinormalisasi dan mengembalikan formulir ke langkah pemilihan port. Tes frontend meliputi respons lama dan konflik port. |
| Tinggi | Profil PPP dapat mewarisi parent/posisi queue yang menunjuk queue CLIENT yang sudah dihapus; RouterOS menolak membuat queue dan sesi putus berulang. | Script profil internet/isolir baru menetapkan `parent-queue=none insert-queue-before=first`. Tes generator memeriksa posisi first dan tidak bergantung pada CLIENT. Ini hanya memperbaiki script yang dihasilkan, bukan otomatis mengubah router terpasang. |
| Tinggi | Update backend dapat me-restart aplikasi dengan kolom/index database yang belum tersedia; build lama juga dihentikan dan dist dibersihkan sebelum compiler berhasil. | Preflight read-only memeriksa kolom dan index unik dari Prisma sebelum restart. Compiler membangun ke folder staging dan mempromosikan dist hanya setelah sukses serta menemukan main.js. Enam tes baru mencakup odp_port/index unik yang hilang dan kegagalan compiler yang mempertahankan dist lama. |
| Sedang | Panduan Word masih memakai Node 22 dan contoh pemulihan queue bergantung pada CLIENT. | Diselaraskan dengan sumber Markdown: Node 26, profil first/none dan alur update dengan preflight/staging. Word 15 halaman dirender dan diperiksa visual. |

Uptime yang menjadi pemicu audit sudah diperbaiki pada baseline sebelumnya: durasi accounting terakhir ditambah waktu sejak `acctupdatetime`, dengan zona waktu sumber yang benar. Sesi PPPoE yang benar-benar putus tetap mempunyai uptime baru; hitungan web tidak membuktikan router stabil. Tes backend terkait accounting dan sesi ikut dijalankan kembali dalam suite penuh.

## Dependency

Pembaruan dilakukan dalam rentang versi manifest, tanpa `--force` atau migrasi versi mayor. Contoh paket yang berubah: body-parser, qs, proxy-addr, multer, systeminformation dan platform-express. Lockfile frontend tetap menyertakan paket optional WASM lintas platform.

- `npm --prefix frontend audit`: **0 kerentanan** setelah pembaruan dan install ulang.
- `npm --prefix backend audit --omit=dev`: **0 kerentanan** dependency produksi.
- Audit lengkap backend masih melaporkan **8 temuan alat pengembangan: 2 low, 6 moderate**, pada rantai Vitest/mocker dan Nest CLI/deepmerge/glob/minimatch. Perintah perbaikan dalam rentang versi saat ini belum menuntaskannya; pembaruan mayor alat tersebut memerlukan pekerjaan kompatibilitas tersendiri. Angka ini adalah hasil advisory registry saat audit, bukan bukti aplikasi dapat dieksploitasi.

## Validasi lokal

| Pemeriksaan | Hasil |
| --- | --- |
| Backend `npm.cmd --prefix backend test` | 50 file, **371 tes lulus** setelah perbaikan terakhir |
| Frontend ChromeHeadless | **300 tes lulus** setelah pembaruan dependency |
| Skrip Node: generator SQL, preflight skema, staging build, VPN sync/status | **14 tes lulus** |
| Skrip Python `unittest discover -s scripts -p 'test_*.py'` | 68 kasus: **66 lulus, 2 dilewati** karena fitur symlink Linux pada Windows |
| Bot WhatsApp `go test -p 1 ./...` | Lulus menggunakan **Go 1.27.3**, `GOTOOLCHAIN=local`, `CGO_ENABLED=0` |
| Build backend ke staging | Lulus menggunakan Prisma Client 6.12.0 yang digenerate ulang |
| `npm.cmd run preparefe` | Build produksi lulus; **releases/frontend.tar.gz** diperbarui dari sumber lokal terbaru |
| Validasi arsip terhadap working tree | Tree `05ac552f5292ff454267941cd0da015eef68de35`, **52 checksum aset lulus**; belum commit/push |
| `npm.cmd run database:check` | database.sql sesuai schema Prisma; pemeriksaan ini tidak menghubungi database |
| Bash syntax | 8 skrip shell dan 20 blok Bash panduan instalasi lulus |
| Lint backend | 0 error; 7 warning lama (unused variable/spread dan kontrol regex untuk sanitasi backup) |
| Panduan `install.doc` | 15 halaman dirender dan diperiksa visual, termasuk bagian yang berubah |

Beberapa regresi dijalankan terhadap kode sebelum perbaikan untuk membuktikan kegagalannya, termasuk invoice ke-501, siklus topologi, penyusutan splitter, ACC ganda, aktivasi ulang paket dan calon isolir yang sudah berubah status. Pengujian transaksi bersamaan di sini memakai fixture; perilaku lock/deadlock MySQL belum diuji di server nyata.

Setelah install ulang dependency backend, `prisma:generate` wajib dijalankan sebelum tes/build. Kegagalan lokal pertama akibat client yang belum digenerate diperbaiki dengan langkah tersebut, kemudian suite penuh dan build diulang sampai lulus. Tidak ada migrasi database yang dijalankan.

## Batas yang masih perlu diverifikasi

1. Uji transaksi MySQL nyata untuk dua ACC bersamaan, dua kolektor pada invoice sama, serta pembayaran bersamaan dengan scheduler isolir. Konflik/deadlock harus rollback tanpa pemasukan ganda atau akun lunas tetap terisolir.
2. Uji PSB nyata: dua teknisi berebut port sama, rollback foto, pindah pelanggan saat preview memuat, dan download foto privat dengan role berbeda.
3. Uji alur perangkat: autentikasi PPPoE, Accounting-Start/Interim/Stop, Disconnect ACK/NAK, pembayaran memulihkan akses, serta paket dinonaktifkan/diaktifkan kembali. Sesi dan counter queue harus diperiksa langsung.
4. Uji updater pada Ubuntu staging dengan database tidak cocok dan compiler gagal. Tes helper lokal belum membuktikan seluruh instalasi systemd/FreeRADIUS/SSTP berhasil. Pembaruan ini tidak menyediakan rollback menyeluruh untuk setiap kegagalan layanan setelah build berhasil.
5. Tidak ada suite HTTP end-to-end lengkap yang menghubungkan browser, database, RADIUS dan WhatsApp. Tes unit/komponen yang lulus tidak menggantikan alur tersebut.
6. Temuan dependency alat pengembangan yang tersisa perlu ditangani dalam pembaruan mayor terpisah. Foto instalasi lama setelah penggantian yang sukses juga belum memiliki proses pembersihan arsip; rollback hanya membersihkan file baru yang gagal disimpan.

## Penerapan setelah review

Kode backend, frontend dan paket frontend lokal perlu berada dalam commit yang sama sebelum pembaruan penuh VPS. Paket sudah dibangun di laptop; tidak perlu upload ke GitHub untuk menjalankan build lokal.

Setelah commit/push dan sesuai prosedur operasional VPS, gunakan `npm run update` untuk perubahan lengkap ini. `updatebe` hanya menerapkan backend; `updatefe` hanya frontend. Audit ini belum menjalankan ketiganya di VPS.

Preflight baru tidak memigrasikan database. Bila kolom/index seperti `odp_port` dari fitur port sebelumnya belum tersedia, updater berhenti; ikuti [panduan port aktivasi PSB](port-aktivasi-psb.md). Jangan impor ulang database.sql pada database yang berisi data.

Untuk profil lama pada router, ikuti [panduan bandwidth PPPoE](pppoe-bandwidth.md), sesuaikan nama profil, lalu uji hanya sesi pelanggan yang ditentukan. Simpan konfigurasi/backup sesuai prosedur operasional. Script generator baru tidak otomatis memperbarui profil router yang sudah dipasang.

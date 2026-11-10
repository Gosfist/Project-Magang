# Kalkulator Redaman

Buka Teknisi > Kalkulator Redaman. Isi daya sumber dalam dBm, jarak kabel dalam
meter, splitter, jumlah konektor, loss per konektor, serta loss kabel per km.
Untuk splitter asimetris, pilih jalur persentase yang dipakai. Perhitungan
berlangsung pada browser dan tidak menyimpan data ke database.

Rumus yang digunakan halaman:

- Loss splitter simetris = 10 log10(jumlah keluaran).
- Loss rasio = -10 log10(persentase jalur / 100).
- Loss kabel = jarak meter / 1000 dikali loss kabel per km.
- Loss konektor = jumlah konektor dikali loss per konektor.
- Daya keluaran sebelum margin (dBm) = daya sumber - loss splitter/rasio - loss kabel - loss konektor.
- Estimasi daya setelah margin (dBm) = daya keluaran sebelum margin - margin perencanaan 1 dB.
- Total redaman (dB) = loss splitter/rasio + loss kabel + loss konektor; margin ditampilkan terpisah.

Dengan sumber 5 dBm, jarak 500 m, splitter 1:2, dua konektor masing-masing 0,5 dB,
dan kabel 0,35 dB/km, hasilnya: splitter 3,01 dB, kabel 0,175 dB, konektor 1,00 dB,
dan keluaran -0,19 dBm setelah margin. Ini perkiraan berdasarkan parameter yang
diisi; gunakan nilai loss perangkat/kabel yang sebenarnya untuk perencanaan.

Bug 20 Oktober 2026: computed membaca properti biasa, sehingga hasil render awal
dengan kolom kosong tersimpan dan tidak dihitung ulang. Seluruh input kini signal;
computed membaca signal tersebut dan ngModel memperbaruinya saat pengguna mengisi
angka, mengganti splitter, atau memilih jalur rasio. Tidak membutuhkan API backend.

Kolom kosong/angka loss negatif menampilkan tanda - pada hasil yang bergantung
pada input tersebut. Nol tetap valid, termasuk sumber 0 dBm dan kabel 0 meter.
Daya sumber negatif juga valid. Saat jenis splitter berubah, pilihan jalur ikut
berubah dan kembali ke jalur pertama rasio baru. Uji regresi melalui input/select
DOM mencakup angka contoh di atas, penggantian rasio, perubahan loss, nol, serta
pengosongan kolom. Hasil browser produksi tetap perlu diperiksa setelah deploy
frontend terbaru.

## Daya dBm dan redaman dB

Nilai daya optik memakai dBm. -5 dBm lebih kuat daripada -6 dBm; perubahan
-5 menjadi -4 berarti daya bertambah, bukan berkurang. Redaman/loss komponen
ditulis sebagai besaran kehilangan yang positif dalam dB dan dikurangkan dari
daya sumber. Jangan menambahkan loss agar angka negatif mendekati nol: hal itu
akan mensimulasikan penguatan pada kabel atau splitter pasif. Daya lebih kuat
juga harus tetap sesuai rentang penerima perangkat, bukan selalu lebih baik.

Rujukan: [Fluke Networks tentang dB dan dBm](https://www.flukenetworks.com/knowledge-base/dsp-fta-series/db-vs-dbm)
dan [Cisco tentang daya masukan, keluaran, dan loss](https://www.cisco.com/c/en/us/support/docs/optical/synchronous-digital-hierarchy-sdh/29000-db-29000.html).

## Main Core Server Rasio ODC dan ODP

Kolom Daya sumber/Daya masuk menyimpan daya dalam dBm. Nama field API/database
`redamanIn` dipertahankan untuk kompatibilitas; ini bukan besaran loss dB.
Perkiraan otomatis menuju titik berikutnya mengurangi splitter milik sumber,
loss kabel 0,35 dB/km, dua konektor masing-masing 0,5 dB (total 1 dB),
dan margin 1 dB per segmen. Parameter ini sama untuk semua jalur menuju ODC, ODP,
dan Rasio, termasuk dari Server, serta menjadi nilai awal kalkulator. Splitter ODC/ODP tujuan
belum dikurangi pada daya masuknya; loss splitter itu diterapkan ketika menghitung
cabang keluar menuju titik berikutnya. Rasio memakai persentase port yang dipilih.

| Daya masuk sumber | Sumber dan cabang | Kabel | Tujuan | Estimasi setelah margin |
| --- | --- | --- | --- | --- |
| -5 dBm | Server, tanpa splitter | 100 m | ODC | -7,04 dBm |
| -5 dBm | ODC splitter 1:4 | 100 m | ODP | -13,06 dBm |
| -5 dBm | Rasio, port 10% | 100 m | ODC | -17,04 dBm |
| -5 dBm | Rasio, port 90% | 100 m | ODC | -7,49 dBm |

Server -5 dBm ke ODC 100 m: -5 - 0,035 - 1 (konektor) - 1 (margin)
= -7,035 dBm, ditampilkan -7,04 dBm. Selisih sekitar 2 dB pada jarak pendek
berasal dari konektor dan margin perencanaan, selain loss kabel. Margin adalah cadangan rancangan, bukan hasil ukur power meter;
margin berulang pada tiap segmen membuat estimasi rantai lebih konservatif.
Angka splitter menggunakan loss pembagian ideal; loss tambahan perangkat nyata
harus mengacu ke datasheet/pengukuran.

Daya sumber kosong tetap tidak diketahui, tidak diasumsikan 0 dBm. Nilai sumber
0 dBm tetap valid. Port yang belum dipilih atau persentase rasio sumber yang tidak valid tidak menghasilkan estimasi cabang; backend tidak mengasumsikan pembagian 50:50 untuk data rasio yang rusak.
Pembulatan otomatis frontend/backend kini sama, dua desimal, termasuk nilai negatif.
Data tersimpan atau hasil ukur yang diisi manual tidak dimigrasikan/ditimpa massal.
Telusuri Jalur hanya menampilkan koneksi dan data tersimpan, bukan pengukuran optik langsung.

Contoh perbandingan 250 m dengan sumber -6 dBm: daya masuk ODC dari Server
adalah -8,09 dBm setelah konektor dan margin, sebelum splitter ODC. Kalkulator
dengan splitter 1:2 menghasilkan -11,10 dBm setelah margin karena juga mengurangi
loss splitter 3,01 dB. Untuk membandingkan titik yang sama, gunakan sumber ODC
dengan daya masuk -6 dBm dan splitter 1:2 menuju ODP 250 m: hasil Main Core dan
kalkulator sama-sama -11,10 dBm. Mengurangi splitter tujuan pada daya masuk akan
menghitung splitter dua kali ketika jalur dilanjutkan ke titik berikutnya.

## Panduan memahami perhitungan untuk presentasi atau sidang

### 1. Bedakan daya dengan loss

**Daya optik** adalah kekuatan sinyal di suatu titik, satuannya dBm. Acuannya
1 mW: `P(dBm) = 10 log10(P(mW) / 1 mW)`. Contohnya 0 dBm = 1 mW,
-10 dBm = 0,1 mW. Karena skala logaritmik, angka negatif bukan berarti daya
fisiknya negatif. -6 dBm lebih lemah daripada -5 dBm.

**Redaman/loss** adalah besarnya daya yang hilang, satuannya dB. Loss 3 dB
berarti daya tersisa sekitar setengah. Jika masukan -6 dBm melewati komponen
dengan loss 3 dB, keluaran menjadi -9 dBm. Jadi loss dikurangkan dari daya.

ODC dan ODP pada aplikasi adalah lokasi perangkat pasif, bukan penguat sinyal.
Nama ODC/ODP sendiri tidak menambah loss: aplikasi menghitung komponen yang
dimodelkan, yaitu splitter sumber, kabel, dan konektor, lalu cadangan margin.

### 2. Rumus yang benar-benar dipakai aplikasi

Untuk satu segmen dari titik A menuju titik B:

```text
L_kabel      = (jarak_meter / 1000) × 0,35 dB/km
L_konektor   = 2 × 0,5 dB = 1 dB
L_fisik      = L_splitter_sumber + L_kabel + L_konektor
P_B_estimasi = P_A - L_fisik - 1 dB margin
```

| Komponen | Asal angka | Makna dalam aplikasi |
| --- | --- | --- |
| P_A | Daya sumber/masuk yang tersimpan pada titik A | Nilai acuan, dapat berupa hasil ukur atau estimasi sebelumnya |
| Splitter sumber | Jenis splitter atau persentase port pada titik A | Dihitung dengan rumus pembagian daya ideal |
| 0,35 dB/km | Parameter kabel yang dipilih untuk model aplikasi | Bukan angka universal untuk semua kabel/panjang gelombang |
| 2 konektor | Asumsi dua titik koneksi pada setiap segmen | Bukan hasil pendeteksian jumlah konektor di lapangan |
| 0,5 dB per konektor | Parameter loss tiap koneksi pada model | Nilai nyata bergantung perangkat dan kondisi sambungan |
| 1 dB margin | Cadangan perencanaan aplikasi setiap segmen | Bukan loss fisik yang diukur power meter |

Parameter tersebut sama untuk tujuan Rasio, ODC, dan ODP, termasuk ODP → ODP.
Kalkulator memakai nilai awal yang sama, tetapi input konektor/kabelnya dapat
diubah untuk simulasi. Main Core memakai parameter tetap di atas.

### 3. Splitter simetris: dari mana 3,01 dan 6,02 dB?

Splitter 1:N membagi daya masukan secara ideal sama besar ke N keluaran.
Setiap keluaran memperoleh bagian `1/N`, sehingga:

```text
L_splitter = -10 log10(1/N) = 10 log10(N)
```

| Splitter sumber | Bagian daya tiap port | Perhitungan | Loss ideal tiap port |
| --- | --- | --- | --- |
| 1:2 | 50% | 10 log10(2) | 3,01 dB |
| 1:4 | 25% | 10 log10(4) | 6,02 dB |
| 1:8 | 12,5% | 10 log10(8) | 9,03 dB |

Contoh **ODC → ODP**, daya masuk ODC -6 dBm, kabel 250 m:

```text
Loss kabel = 250 / 1000 × 0,35 = 0,0875 dB

ODC memakai 1:2:
P_ODP = -6 - 3,0103 - 0,0875 - 1 - 1 = -11,0978 ≈ -11,10 dBm

ODC memakai 1:4:
P_ODP = -6 - 6,0206 - 0,0875 - 1 - 1 = -14,1081 ≈ -14,11 dBm
```

Selisihnya sekitar 3,01 dB karena 1:4 memberi setiap port setengah daya yang
diperoleh port 1:2. Dengan input yang sama, hasil sekitar -11 dan -14 dBm
sesuai rumus. Jika sumbernya **ODP → ODP**, hasil contoh ini tetap sama:
yang menentukan adalah daya dan splitter ODP sumber, bukan nama kategorinya.
Loss 1:4 tetap 6,02 dB meskipun baru satu port digunakan; aplikasi tidak membagi
ulang daya berdasarkan jumlah pelanggan/port yang sedang terpakai.

### 4. Rasio asimetris: port kecil kehilangan daya lebih banyak

Pada kategori Rasio, dua port tidak harus menerima daya sama besar.
Jika port memperoleh p persen daya, rumusnya:

```text
L_port = -10 log10(p / 100)
```

| Pembagian daya | Loss pada port pertama | Loss pada port kedua |
| --- | --- | --- |
| 50% / 50% | 3,01 dB | 3,01 dB |
| 70% / 30% | 1,55 dB | 5,23 dB |
| 80% / 20% | 0,97 dB | 6,99 dB |
| 90% / 10% | 0,46 dB | 10,00 dB |

Persentase mengikuti konfigurasi port yang disimpan. Jangan menganggap Port 1
selalu 90%: nilai awal Main Core justru Port 1 = 10% dan Port 2 = 90%.
Jumlah dua persentase harus 100%, dan masing-masing harus lebih dari nol.

Contoh daya masuk Rasio -6 dBm, kabel menuju ODP 250 m:

```text
Keluar melalui port 10%:
P_ODP = -6 - 10 - 0,0875 - 1 - 1 = -18,0875 ≈ -18,09 dBm

Keluar melalui port 90%:
P_ODP = -6 - 0,4576 - 0,0875 - 1 - 1 = -8,5451 ≈ -8,55 dBm
```

Port 90% membawa lebih banyak daya, sehingga loss pembagiannya lebih kecil.
Aplikasi hanya memakai loss port yang dilalui; loss kedua port tidak dijumlahkan.
Jika kategori sumbernya Rasio, aplikasi tidak menambahkan loss simetris 1:2
lagi di atas loss persentase tersebut.

### 5. Splitter mana yang dikurangi pada setiap sambungan?

| Sambungan | Splitter yang dikurangi untuk menghitung daya masuk tujuan |
| --- | --- |
| Server → ODC/ODP/Rasio | Tidak ada splitter sumber yang dimodelkan pada Server |
| ODC → ODP/ODC/Rasio | Splitter ODC sumber, misalnya 1:4 |
| ODP → ODP/ODC/Rasio | Splitter ODP sumber, misalnya 1:2 |
| Rasio → ODP/ODC/Rasio | Persentase port Rasio sumber yang dipilih |

Kolom **Daya masuk** terletak sebelum splitter milik titik itu sendiri.
Mengganti splitter tujuan tidak mengubah daya masuk tujuan; pengaruhnya baru
terlihat pada cabang keluar menuju titik berikutnya. Contohnya, mengganti
splitter ODC akan memengaruhi perhitungan menuju ODP anak, bukan daya yang
datang dari Server ke ODC. Ini mencegah satu splitter dikurangi dua kali.

Kalkulator langsung mengurangi splitter yang dipilih. Karena itu, untuk
memeriksa ODC → ODP, masukkan **daya masuk ODC** sebagai sumber kalkulator dan
pilih **splitter ODC**, bukan splitter ODP tujuan. Pilih jarak dan parameter
konektor/kabel yang sama, lalu bandingkan hasil setelah margin.

### 6. Contoh rantai Server → ODC → ODP A → ODP B

Misalnya Server -4 dBm, ODC splitter 1:2, ODP A splitter 1:4:

| Segmen | Daya acuan | Loss splitter sumber | Loss kabel | Konektor | Margin | Daya masuk tujuan |
| --- | --- | --- | --- | --- | --- | --- |
| Server → ODC, 100 m | -4,00 dBm | 0 dB | 0,035 dB | 1 dB | 1 dB | -6,04 dBm |
| ODC → ODP A, 250 m | -6,04 dBm | 3,0103 dB | 0,0875 dB | 1 dB | 1 dB | -11,14 dBm |
| ODP A → ODP B, 100 m | -11,14 dBm | 6,0206 dB | 0,035 dB | 1 dB | 1 dB | -19,20 dBm |

Setiap baris memakai nilai tersimpan titik sebelumnya, dibulatkan dua desimal.
Pembulatan per segmen dapat menimbulkan selisih kecil dibanding perhitungan
seluruh rantai sekaligus tanpa pembulatan. Ada tiga segmen, sehingga contoh
ini mencadangkan margin total 3 dB. Daya akhir tersebut adalah estimasi setelah
cadangan; jangan menyebutnya hasil ukur aktual atau membandingkannya dengan
rumus yang hanya menggunakan satu margin total tanpa menjelaskan perbedaannya.

### 7. Kapan hitungan otomatis berjalan?

Pada form Main Core, memilih port sumber atau mengubah jarak memperbarui
estimasi memakai sumber yang dipilih. Sumber harus memiliki daya masuk yang
diketahui; sumber bukan Server juga memerlukan port sumber yang valid.
Jika jarak dikosongkan setelah pernah diisi, estimasi daya masuk ikut dikosongkan
pada ODC, ODP, dan Rasio. Input angka yang kosong dari browser dapat bernilai
`null`; nilai ini tidak dikonversi menjadi 0 saat menghitung atau menyimpan.
Jarak 0 meter yang diisi secara eksplisit tetap valid: loss kabelnya nol,
sedangkan splitter sumber, konektor, dan margin tetap dihitung.
Backend menghitung sebagai cadangan ketika daya masuk tidak dikirim dan data
sumber/jarak tersedia. Nilai daya masuk yang dikirim eksplisit dipertahankan,
termasuk jika pengguna mengisinya sebagai hasil ukur.

**Mengedit splitter/daya sumber tidak menghitung ulang semua anak yang sudah
tersimpan secara berantai.** Untuk memperbarui estimasi lama, buka dan hitung
ulang setiap anak dari hulu ke hilir, misalnya ubah jarak lalu kembalikan ke
jarak yang benar atau pilih ulang port untuk memicu estimasi, kemudian simpan.
Periksa angka sebelum menyimpan, terutama bila nilai sebelumnya adalah hasil
ukur yang memang ingin dipertahankan. Buka form anak setelah sumber terbaru
disimpan agar pilihan sumber memuat data terbaru. Telusuri Jalur menampilkan
nilai tersimpan, bukan menghitung ulang seluruh jaringan secara langsung.

### 8. Batas model dan jawaban yang bisa disampaikan kepada dosen

Model ini menghitung pembagian daya ideal splitter, loss kabel, konektor, dan
margin. Model belum menyediakan input jumlah/loss sambungan fusion splice,
excess loss splitter dari datasheet, tekukan, kotoran konektor, atau variasi
panjang gelombang. Nilai 0,35 dB/km dan 0,5 dB/koneksi adalah asumsi perencanaan
aplikasi, bukan hasil ukur atau ketentuan universal. Pada rancangan nyata,
gunakan spesifikasi komponen dan verifikasi dengan alat ukur optik. Jika loss
datasheet splitter sudah mencakup konektor, tentukan titik acuannya agar loss
konektor yang sama tidak dihitung lagi.

Jangan menyatakan pelanggan pasti bisa online hanya dari angka estimasi ini.
Daya harus dibandingkan dengan sensitivitas minimum dan batas daya maksimum
penerima sesuai datasheet OLT/ONT; aplikasi ini belum melakukan penilaian
kelayakan otomatis berdasarkan spesifikasi penerima.

Contoh penjelasan singkat:

> Sistem menggunakan pendekatan loss budget. Daya di titik berikutnya dihitung
> dari daya masuk sumber, dikurangi loss splitter pada port yang dilalui,
> loss kabel berdasarkan jarak, dan dua konektor. Sistem menambahkan cadangan
> perencanaan 1 dB setiap segmen. Splitter 1:2 memiliki loss ideal 3,01 dB,
> sedangkan 1:4 memiliki loss ideal 6,02 dB. Rasio tidak simetris dihitung
> berdasarkan persentase daya pada port. Hasilnya merupakan estimasi,
> sedangkan nilai lapangan harus dibuktikan melalui pengukuran.

Dasar teori pembanding: [FOA — pengujian splitter dan loss ideal dibanding loss nyata](https://thefoa.org/tech/ref/testing/test/couplers.html)
menjelaskan pembagian daya dan tambahan loss komponen nyata;
[FOA — perhitungan loss budget](https://thefoa.org/tech/lossbudg.htm)
menjelaskan penjumlahan loss komponen dan perlunya membandingkan estimasi dengan
hasil pengujian. Parameter tetap dan margin per segmen di atas menjelaskan
implementasi aplikasi ini, bukan klaim bahwa semua jaringan memakai angka yang sama.

Lokasi kode untuk penelusuran: `frontend/src/app/shared/optical-power.ts`
(`estimateInputPower`), `backend/src/main-core/shared/main-core.service.ts`
(`validateAndBuild` dan `splitterLoss`), serta
`frontend/src/app/pages/dashboard/tools/kalkulator-redaman/kalkulator-redaman.component.ts`.

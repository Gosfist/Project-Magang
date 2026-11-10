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
loss kabel 0,35 dB/km, loss konektor, dan margin 1 dB per segmen. Pada ODC ke ODP,
model menggunakan dua konektor, masing-masing 0,5 dB. Splitter ODC/ODP tujuan
belum dikurangi pada daya masuknya; loss splitter itu diterapkan ketika menghitung
cabang keluar menuju titik berikutnya. Rasio memakai persentase port yang dipilih.

| Daya masuk sumber | Sumber dan cabang | Kabel | Tujuan | Estimasi setelah margin |
| --- | --- | --- | --- | --- |
| -5 dBm | Server, tanpa splitter | 100 m | ODC | -6,04 dBm |
| -5 dBm | ODC splitter 1:4 | 100 m | ODP | -13,06 dBm |
| -5 dBm | Rasio, port 10% | 100 m | ODC | -16,04 dBm |
| -5 dBm | Rasio, port 90% | 100 m | ODC | -6,49 dBm |

Server -5 dBm ke ODC 100 m: -5 - 0,035 - 1 = -6,035 dBm, ditampilkan -6,04 dBm.
Selisih sekitar 1 dB pada jarak pendek terutama berasal dari margin perencanaan,
bukan kabel saja. Margin adalah cadangan rancangan, bukan hasil ukur power meter;
margin berulang pada tiap segmen membuat estimasi rantai lebih konservatif.
Angka splitter menggunakan loss pembagian ideal; loss tambahan perangkat nyata
harus mengacu ke datasheet/pengukuran.

Daya sumber kosong tetap tidak diketahui, tidak diasumsikan 0 dBm. Nilai sumber
0 dBm tetap valid. Port yang belum dipilih atau persentase rasio sumber yang tidak valid tidak menghasilkan estimasi cabang; backend tidak mengasumsikan pembagian 50:50 untuk data rasio yang rusak.
Pembulatan otomatis frontend/backend kini sama, dua desimal, termasuk nilai negatif.
Data tersimpan atau hasil ukur yang diisi manual tidak dimigrasikan/ditimpa massal.
Telusuri Jalur hanya menampilkan koneksi dan data tersimpan, bukan pengukuran optik langsung.

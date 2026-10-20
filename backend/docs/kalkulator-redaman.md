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
- Hasil dBm = sumber - loss splitter/rasio - loss kabel - loss konektor - margin 1 dB.

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

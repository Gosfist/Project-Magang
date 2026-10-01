# UI dashboard

Aturan bersama berada di `styles.css`. Gunakan komponen `.card`, `.input`,
`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.table-wrap`, `app-modal`,
dan `app-pagination` agar halaman baru mengikuti ukuran yang sama.

## Tipografi

| Penggunaan | Ukuran | Ketebalan |
| --- | --- | --- |
| Isi halaman, data tabel, label, input desktop | 14px | 400; label 500 |
| Header halaman | 18px mobile, 20px desktop | 600 |
| Judul bagian / dialog | 18px | 600 |
| Judul kartu kecil | 14px | 600 |
| Header tabel | 12px | 600 |
| Keterangan pendukung dan badge | 12px | 400 |
| Label aksi tabel | 13px | 400 |
| Tombol utama di luar tabel | 14px | 500 |
| Input mobile | 16px | 400 |

Font antarmuka memakai Arial/Helvetica/sans-serif. Isi tabel tidak memakai
monospace atau font tebal. Pakai `.table-meta` untuk baris keterangan tambahan,
bukan data utama seperti ID, tanggal, nama, dan nominal. Badge `span.rounded-full`
di dalam tabel memakai skala badge secara otomatis. Monospace tetap boleh untuk
blok skrip RouterOS atau template teknis di luar tabel.

## Tata letak

- Jarak antar bagian 16–24px; padding konten 16px mobile dan 24–28px desktop.
- Input/tombol utama minimal 42px. Tombol tabel minimal 34px dan tinggi mengikuti isi.
- Tabel boleh menggulir horizontal di dalam `.table-wrap`; konten halaman tidak
  boleh melebar bersama tabel. Header tetap satu baris, data panjang boleh membungkus.
- Form pelanggan memakai satu kolom mobile dan dua kolom desktop. Form panjang
  menggulir di dalam dialog; jangan mengecilkan teks atau field sesuai tinggi layar.
- Pertahankan warna status, teks error, izin role, dan alur bisnis ketika merapikan UI.
- Jangan menerapkan satu ukuran font ke semua turunan tabel; data, badge,
  keterangan, dan tombol mempunyai fungsi dan ukuran masing-masing.

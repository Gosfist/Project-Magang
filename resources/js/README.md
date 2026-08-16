# Frontend JavaScript Architecture

JavaScript frontend harus masuk ke `resources/js` dan dimuat melalui `app.js`/Vite. Blade hanya menampilkan markup, data dari Laravel, dan atribut `data-*` sebagai penghubung ke JavaScript.

## Folder responsibilities

- `services/`: komunikasi API, autentikasi, token, dan operasi data per domain.
- `components/`: perilaku UI yang dapat digunakan ulang, seperti modal, notifikasi, filter, dan validasi form.
- `pages/`: menghubungkan service dan component pada halaman tertentu.
- `app.js`: satu-satunya entry point Vite dan tempat boot module.

Jangan menaruh business rule keamanan hanya di JavaScript. Validasi dan otorisasi utama tetap harus diterapkan di backend Laravel.

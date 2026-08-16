async function bootApplication() {
    const loaders = [];

    // File Vite yang memiliki nama hash disimpan oleh cache browser.
    // Di sini aplikasi hanya memilih modul yang dibutuhkan halaman, bukan memuat semua fitur.

    // Muat navigasi landing page hanya ketika elemen navigasinya tersedia.
    if (document.querySelector('[data-toggle-target]')) {
        loaders.push(import('./pages/public').then(({ bootPublicPages }) => bootPublicPages()));
    }

    // Muat proses login hanya pada halaman login.
    if (document.querySelector('[data-login-form]')) {
        loaders.push(import('./pages/login').then(({ bootLogin }) => bootLogin()));
    }

    if (document.querySelector('[data-dashboard]')) {
        // Muat kerangka dashboard satu kali setelah pengguna berhasil login.
        loaders.push(import('./pages/dashboard').then(({ bootDashboard }) => bootDashboard()));
    }

    if (document.querySelector('[data-modal]')) {
        // Muat pengendali modal hanya pada halaman yang memiliki modal.
        loaders.push(import('./components/modal').then(({ bootModals }) => bootModals()));
    }

    if (document.querySelector('[data-confirm-submit]')) {
        // Muat konfirmasi form umum hanya ketika dibutuhkan.
        loaders.push(import('./components/confirm-form').then(({ bootConfirmForms }) => bootConfirmForms()));
    }

    if (document.querySelector('[data-maincore-page]')) {
        // Muat asset fitur Main Core hanya pada fitur yang sedang dibuka.
        loaders.push(import('./pages/maincore').then(({ bootMainCore }) => bootMainCore()));
    }

    if (document.querySelector('[data-trace-form]')) {
        // Muat pencarian Trace Jalur hanya pada halaman Trace Jalur.
        loaders.push(import('./pages/trace-jalur').then(({ bootTraceJalur }) => bootTraceJalur()));
    }

    await Promise.all(loaders);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApplication, { once: true });
} else {
    bootApplication();
}

// Bersihkan pesan validasi lama sebelum menampilkan hasil validasi terbaru.
export function clearFormErrors(form) {
    form.querySelectorAll('[data-field-error]').forEach((item) => {
        item.textContent = '';
        item.classList.add('hidden');
    });
}

// Tampilkan satu pesan tepat di bawah kolom yang bermasalah.
export function showSingleFormError(form, field, message) {
    const error = form.querySelector(`[data-field-error="${field}"]`);
    if (!error) return;

    error.textContent = message;
    error.classList.remove('hidden');
}

// Terjemahkan kumpulan kesalahan dari Laravel ke setiap kolom formulir.
export function showFormErrors(form, errors) {
    clearFormErrors(form);

    Object.entries(errors).forEach(([field, messages]) => {
        showSingleFormError(form, field, Array.isArray(messages) ? messages[0] : messages);
    });
}

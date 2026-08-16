export function clearFormErrors(form) {
    form.querySelectorAll('[data-field-error]').forEach((item) => {
        item.textContent = '';
        item.classList.add('hidden');
    });
}

export function showSingleFormError(form, field, message) {
    const error = form.querySelector(`[data-field-error="${field}"]`);
    if (!error) return;

    error.textContent = message;
    error.classList.remove('hidden');
}

export function showFormErrors(form, errors) {
    clearFormErrors(form);

    Object.entries(errors).forEach(([field, messages]) => {
        showSingleFormError(form, field, Array.isArray(messages) ? messages[0] : messages);
    });
}

function existingNames(form) {
    try {
        return JSON.parse(form.dataset.existingNames || '[]').map((item) => ({
            id: Number(item.id),
            name: String(item.nama_titik || '').trim().toLocaleLowerCase('id-ID'),
        }));
    } catch {
        return [];
    }
}

export function validateUniqueName(form) {
    clearFormErrors(form);

    const nameInput = form.querySelector('[name="nama_titik"]');
    const currentId = Number(form.dataset.currentId || 0);
    const currentName = (nameInput?.value || '').trim().toLocaleLowerCase('id-ID');
    const duplicate = currentName && existingNames(form)
        .some((item) => item.id !== currentId && item.name === currentName);

    if (!duplicate) return true;

    showSingleFormError(form, 'nama_titik', form.dataset.uniqueMessage || 'Nama sudah digunakan!');

    return false;
}

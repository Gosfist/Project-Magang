export function bootConfirmForms() {
    document.querySelectorAll('[data-confirm-submit]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            if (!confirm(form.dataset.confirmSubmit)) {
                event.preventDefault();
            }
        });
    });
}

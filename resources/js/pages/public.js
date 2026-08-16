export function bootPublicPages() {
    document.querySelectorAll('[data-toggle-target]').forEach((button) => {
        button.addEventListener('click', () => {
            document.getElementById(button.dataset.toggleTarget)?.classList.toggle('hidden');
        });
    });

    document.querySelectorAll('[data-alert-message]').forEach((button) => {
        button.addEventListener('click', () => alert(button.dataset.alertMessage));
    });
}

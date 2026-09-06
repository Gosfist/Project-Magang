export function bootPublicPages() {
    document.querySelectorAll('[data-toggle-target]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.toggleTarget);

            target?.classList.toggle('hidden');
            button.setAttribute('aria-expanded', String(!target?.classList.contains('hidden')));
        });
    });

    document.querySelectorAll('#mobileMenu a').forEach((link) => {
        link.addEventListener('click', () => {
            document.getElementById('mobileMenu')?.classList.add('hidden');
            document.querySelector('[data-toggle-target="mobileMenu"]')?.setAttribute('aria-expanded', 'false');
        });
    });

    document.querySelectorAll('[data-alert-message]').forEach((button) => {
        button.addEventListener('click', () => alert(button.dataset.alertMessage));
    });
}

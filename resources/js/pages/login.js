import { forgetAuthentication, login } from '../services/auth-service';

export function bootLogin() {
    const form = document.querySelector('[data-login-form]');
    if (!form) return;

    forgetAuthentication();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const errorBox = document.querySelector('[data-login-error]');
        const submit = form.querySelector('[type="submit"]');
        errorBox.classList.add('hidden');
        errorBox.textContent = '';
        submit.disabled = true;

        try {
            const payload = await login(form.action, new FormData(form));
            window.location.href = payload.redirect_url;
        } catch (error) {
            errorBox.textContent = error.message || 'Login gagal.';
            errorBox.classList.remove('hidden');
        } finally {
            submit.disabled = false;
        }
    });
}

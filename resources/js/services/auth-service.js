import { apiFetch, clearAccessToken, storeAccessToken } from './api';

export async function login(url, formData) {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
        const messages = Object.values(payload.errors || {}).flat();
        throw new Error(messages.join(' ') || payload.message || 'Login gagal.');
    }

    storeAccessToken(payload);

    return payload;
}

export function currentUser(url) {
    return apiFetch(url).then((response) => response.ok ? response.json() : null);
}

export function forgetAuthentication() {
    clearAccessToken();
}

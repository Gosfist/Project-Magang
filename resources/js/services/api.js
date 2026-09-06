const tokenKey = 'unzanet_jwt';
const expiresAtKey = 'unzanet_jwt_expires_at';
const verifiedTokenKey = 'unzanet_jwt_verified';

export function storeAccessToken(payload) {
    localStorage.setItem(tokenKey, payload.access_token);
    localStorage.setItem(expiresAtKey, payload.expires_at);
    sessionStorage.removeItem(verifiedTokenKey);
}

export function clearAccessToken() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(expiresAtKey);
    sessionStorage.removeItem(verifiedTokenKey);
}

export function accessTokenWasVerified() {
    return sessionStorage.getItem(verifiedTokenKey) === localStorage.getItem(tokenKey);
}

export function markAccessTokenVerified() {
    const token = localStorage.getItem(tokenKey);
    if (token) sessionStorage.setItem(verifiedTokenKey, token);
}

export function accessTokenExpiresAt() {
    return Date.parse(localStorage.getItem(expiresAtKey) || '');
}

function notifyUnauthorized() {
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem(tokenKey);

    if (!token) {
        notifyUnauthorized();
        throw new Error('Token tidak ditemukan. Silakan login kembali.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        notifyUnauthorized();
        throw new Error('Token telah kedaluwarsa. Silakan login kembali.');
    }

    return response;
}

export async function parseResponsePayload(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return response.json();
    }

    return {
        message: response.ok && !response.redirected
            ? 'Data berhasil disimpan.'
            : 'Data gagal disimpan. Periksa kembali isian form.',
        errors: {},
    };
}

import { apiFetch, parseResponsePayload } from './api';

// Kirim perubahan Add, Edit, atau Hapus tanpa memuat ulang seluruh dashboard.
export async function submitMainCoreForm(form) {
    const response = await apiFetch(form.action, {
        method: 'POST',
        body: new FormData(form),
    });

    return {
        response,
        payload: await parseResponsePayload(response),
    };
}

// Ambil ulang hanya potongan tampilan fitur beserta lima baris pada halaman aktif.
export async function loadMainCoreFeature(url, page = 1) {
    const endpoint = new URL(url, window.location.origin);
    endpoint.searchParams.set('fragment', '1');
    endpoint.searchParams.set('per_page', '5');
    endpoint.searchParams.set('page', String(page));

    const response = await apiFetch(endpoint);
    const payload = await parseResponsePayload(response);

    if (!response.ok || !payload.fragment) {
        throw new Error(payload.message || 'Data fitur gagal dimuat.');
    }

    return payload;
}

// Muat satu modal Edit hanya saat pengguna menekan tombol Edit pada baris tersebut.
export async function loadMainCoreEditModal(url) {
    const response = await apiFetch(url);
    const payload = await parseResponsePayload(response);

    if (!response.ok || !payload.fragment) {
        throw new Error(payload.message || 'Form edit gagal dimuat.');
    }

    return payload.fragment;
}

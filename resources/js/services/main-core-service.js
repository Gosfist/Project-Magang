import { apiFetch, parseResponsePayload } from './api';

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

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

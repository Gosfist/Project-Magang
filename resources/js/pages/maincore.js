import { showFormErrors, validateUniqueName } from '../components/form-errors';
import { showNotice } from '../components/notification';
import { bootSplitterFields } from '../components/splitter-fields';
import { bootTableFilter } from '../components/table-filter';
import { submitMainCoreForm } from '../services/main-core-service';

export function bootMainCore() {
    const page = document.querySelector('[data-maincore-page]');
    if (!page) return;

    bootTableFilter(page);
    bootSplitterFields(document);

    document.querySelectorAll('[data-maincore-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;

            const submit = form.querySelector('[type="submit"]');
            submit?.setAttribute('disabled', 'disabled');

            try {
                if (!validateUniqueName(form)) return;

                const { response, payload } = await submitMainCoreForm(form);

                if (!response.ok || response.redirected) {
                    showFormErrors(form, payload.errors || {});
                    const errors = Object.values(payload.errors || {}).flat().join(' ');
                    showNotice(payload.message || errors || 'Data gagal disimpan.', 'error');
                    return;
                }

                showNotice(payload.message || 'Data berhasil disimpan.', 'success');
                setTimeout(() => window.location.reload(), 700);
            } catch (error) {
                showNotice(error.message || 'Data gagal disimpan.', 'error');
            } finally {
                submit?.removeAttribute('disabled');
            }
        });
    });
}

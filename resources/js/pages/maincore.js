import { closeModal } from '../components/modal';
import { showFormErrors, validateUniqueName } from '../components/form-errors';
import { showNotice } from '../components/notification';
import { bootParentComboboxes } from '../components/parent-combobox';
import { bootSplitterFields } from '../components/splitter-fields';
import { bootTableFilter } from '../components/table-filter';
import { loadMainCoreFeature, submitMainCoreForm } from '../services/main-core-service';

function currentPage() {
    return Number(new URL(window.location.href).searchParams.get('page')) || 1;
}

function fragmentElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    return template.content.querySelector('[data-maincore-feature]');
}

async function refreshFeature(feature, requestedPage = currentPage()) {
    const payload = await loadMainCoreFeature(feature.dataset.apiUrl, requestedPage);

    // Jika data terakhir pada suatu halaman dihapus, muat halaman valid terakhir.
    if (payload.meta.current_page > payload.meta.last_page) {
        return refreshFeature(feature, Math.max(payload.meta.last_page, 1));
    }

    const replacement = fragmentElement(payload.fragment);
    if (!replacement) throw new Error('Tampilan fitur dari API tidak valid.');

    feature.replaceWith(replacement);
    bootFeature(replacement);

    const page = Math.max(payload.meta.current_page, 1);
    const location = new URL(window.location.href);
    if (page > 1) location.searchParams.set('page', String(page));
    else location.searchParams.delete('page');
    window.history.replaceState({}, '', location);
}

function bootPagination(feature) {
    feature.querySelectorAll('[data-maincore-pagination] a').forEach((link) => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const page = Number(new URL(link.href).searchParams.get('page')) || 1;

            try {
                // Pagination hanya meminta ulang data fitur aktif melalui API.
                await refreshFeature(feature, page);
            } catch (error) {
                showNotice(error.message || 'Halaman data gagal dimuat.', 'error');
            }
        });
    });
}

function bootForms(feature) {
    feature.querySelectorAll('[data-maincore-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;

            const submit = form.querySelector('[type="submit"]');
            submit?.setAttribute('disabled', 'disabled');

            try {
                if (!validateUniqueName(form)) return;

                // Add, edit, dan hapus dikirim ke API tanpa memuat ulang halaman dashboard.
                const { response, payload } = await submitMainCoreForm(form);

                if (!response.ok || response.redirected) {
                    showFormErrors(form, payload.errors || {});
                    const errors = Object.values(payload.errors || {}).flat().join(' ');
                    showNotice(payload.message || errors || 'Data gagal disimpan.', 'error');
                    return;
                }

                const openedModal = form.closest('[data-modal]');
                if (openedModal) closeModal(openedModal.id);

                // Muat ulang hanya tabel, pagination, dan modal dari fitur yang berubah.
                await refreshFeature(feature);
                openedModal?.remove();
                showNotice(payload.message || 'Data berhasil disimpan.', 'success');
            } catch (error) {
                showNotice(error.message || 'Data gagal disimpan.', 'error');
            } finally {
                submit?.removeAttribute('disabled');
            }
        });
    });
}

function bootFeature(feature) {
    const page = feature.querySelector('[data-maincore-page]');
    if (!page) return;

    // Aktifkan ulang hanya komponen yang baru diganti oleh respons API.
    bootTableFilter(page);
    bootSplitterFields(feature);
    bootParentComboboxes(feature);
    bootForms(feature);
    bootPagination(feature);
}

export function bootMainCore() {
    const feature = document.querySelector('[data-maincore-feature]');
    if (!feature) return;

    bootFeature(feature);
}

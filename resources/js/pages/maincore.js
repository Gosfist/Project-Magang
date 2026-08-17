import { closeModal, openModal } from '../components/modal';
import { showFormErrors } from '../components/form-errors';
import { showNotice } from '../components/notification';
import { bootParentComboboxes } from '../components/parent-combobox';
import { bootCableAttenuation } from '../components/cable-attenuation';
import { bootTableFilter } from '../components/table-filter';
import {
    loadMainCoreEditModal,
    loadMainCoreFeature,
    submitMainCoreForm,
} from '../services/main-core-service';

// Ambil nomor halaman dari alamat browser untuk mempertahankan posisi pengguna.
function currentPage() {
    return Number(new URL(window.location.href).searchParams.get('page')) || 1;
}

// Ubah teks HTML dari API menjadi elemen fitur yang siap dipasang ke halaman.
function fragmentElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    return template.content.querySelector('[data-maincore-feature]');
}

// Ubah teks HTML modal menjadi elemen modal yang siap dipasang ke dokumen.
function modalElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    return template.content.querySelector('[data-modal]');
}

// Perbarui area fitur setelah Add, Edit, atau Hapus berhasil dilakukan.
async function refreshFeature(feature, requestedPage = currentPage()) {
    const payload = await loadMainCoreFeature(feature.dataset.apiUrl, requestedPage);

    // Jika data terakhir pada suatu halaman dihapus, muat halaman valid terakhir.
    if (payload.meta.current_page > payload.meta.last_page) {
        return refreshFeature(feature, Math.max(payload.meta.last_page, 1), options);
    }

    const replacement = fragmentElement(payload.fragment);
    if (!replacement) throw new Error('Tampilan fitur dari API tidak valid.');

    feature.replaceWith(replacement);
    bootFeature(replacement);

    return replacement;
}

// Hubungkan satu formulir agar hanya perubahan datanya yang dikirim ke API.
function bootForm(form, feature) {
    if (!form || form.dataset.maincoreFormReady === 'true') return;
    form.dataset.maincoreFormReady = 'true';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;

        const submit = form.querySelector('[type="submit"]');
        submit?.setAttribute('disabled', 'disabled');

        try {
            // Nama unik diperiksa Laravel agar browser tidak perlu mengunduh seluruh nama titik.
            const { response, payload } = await submitMainCoreForm(form);

            if (!response.ok || response.redirected) {
                showFormErrors(form, payload.errors || {});
                const errors = Object.values(payload.errors || {}).flat().join(' ');
                showNotice(payload.message || errors || 'Data gagal disimpan.', 'error');
                return;
            }

            const openedModal = form.closest('[data-modal]');
            if (openedModal) closeModal(openedModal.id);

            // Setelah perubahan berhasil, perbarui hanya tabel dan pagination fitur aktif.
            await refreshFeature(feature);
            openedModal?.remove();
            showNotice(payload.message || 'Data berhasil disimpan.', 'success');
        } catch (error) {
            showNotice(error.message || 'Data gagal disimpan.', 'error');
        } finally {
            submit?.removeAttribute('disabled');
        }
    });
}

// Aktifkan seluruh formulir yang memang sudah tersedia di fragmen fitur.
function bootForms(feature) {
    feature.querySelectorAll('[data-maincore-form]').forEach((form) => {
        bootForm(form, feature);
    });
}

// Pasang tombol Edit yang meminta satu modal dari API hanya ketika diklik.
function bootEditButtons(feature) {
    feature.querySelectorAll('[data-load-edit-modal]').forEach((button) => {
        if (button.dataset.editButtonReady === 'true') return;
        button.dataset.editButtonReady = 'true';

        button.addEventListener('click', async () => {
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Memuat...';

            try {
                const html = await loadMainCoreEditModal(button.dataset.editUrl);
                const modal = modalElement(html);
                if (!modal?.id) throw new Error('Form edit dari API tidak valid.');

                // Hapus salinan lama agar hanya satu modal untuk baris ini berada di dokumen.
                document.getElementById(modal.id)?.remove();
                document.body.appendChild(modal);
                bootCableAttenuation(modal);
                bootParentComboboxes(modal);
                bootForm(modal.querySelector('[data-maincore-form]'), feature);
                openModal(modal.id);
            } catch (error) {
                showNotice(error.message || 'Form edit gagal dimuat.', 'error');
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    });
}

// Aktifkan kembali komponen interaktif setelah fragmen fitur diganti.
function bootFeature(feature) {
    const page = feature.querySelector('[data-maincore-page]');
    if (!page) return;

    // Aktifkan ulang hanya komponen yang baru diganti oleh respons API.
    bootTableFilter(page);
    bootCableAttenuation(feature);
    bootParentComboboxes(feature);
    bootForms(feature);
    bootEditButtons(feature);
}

// Titik awal modul Main Core saat halaman dashboard pertama kali dibuka.
export function bootMainCore() {
    const feature = document.querySelector('[data-maincore-feature]');
    if (!feature) return;

    bootFeature(feature);
}

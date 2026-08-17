import { apiFetch } from '../services/api';

const minimumSearchLength = 2;
const searchDelay = 250;
let outsideClickReady = false;

// Ubah data port dari atribut HTML menjadi array angka yang aman digunakan.
function parsePorts(value) {
    try {
        return JSON.parse(value).map(Number);
    } catch {
        return [];
    }
}

// Tampilkan satu pilihan ketika parent belum dipilih atau tidak mempunyai port.
function setSinglePortOption(portSelect, label) {
    portSelect.innerHTML = '';
    portSelect.disabled = true;
    portSelect.required = false;
    portSelect.appendChild(new Option(label, ''));
}

// Tampilkan semua port; port terpakai tetap terlihat tetapi tidak dapat dipilih.
function syncParentPort(combobox) {
    const form = combobox.closest('form');
    const parentInput = combobox.querySelector('[data-parent-id]');
    const portSelect = form?.querySelector('[data-port-select]');

    if (!parentInput || !portSelect) return;

    const selectedParent = Array.from(combobox.querySelectorAll('[data-parent-option]'))
        .find((option) => option.dataset.parentIdValue === parentInput.value);

    if (!selectedParent) {
        setSinglePortOption(portSelect, 'Pilih sumber jalur terlebih dahulu');
        return;
    }

    if (selectedParent.dataset.parentType === 'server') {
        setSinglePortOption(portSelect, 'Server/Core tidak memakai port');
        return;
    }

    const outputCount = Number(selectedParent.dataset.outputCount || 0);
    const usedPorts = parsePorts(selectedParent.dataset.usedPorts || '[]');
    const selectedPort = Number(portSelect.dataset.selectedPort || 0);
    const currentParent = String(parentInput.dataset.currentParent || '');
    const currentPort = currentParent === parentInput.value ? selectedPort : 0;
    portSelect.innerHTML = '';
    portSelect.disabled = false;
    portSelect.required = true;
    portSelect.setCustomValidity('');
    portSelect.appendChild(new Option('Pilih port', ''));

    for (let port = 1; port <= outputCount; port++) {
        const isUsed = usedPorts.includes(port) && port !== currentPort;
        const option = new Option(`Port ${port}`, port);

        option.disabled = isUsed;
        option.style.color = isUsed ? '#dc2626' : '#16a34a';
        option.selected = port === currentPort;
        portSelect.appendChild(option);
    }
}

// Buat tombol parent dengan DOM API agar teks dari server tidak disisipkan sebagai HTML.
function createParentOption(parent) {
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.parentOption = '';
    option.dataset.parentIdValue = String(parent.id);
    option.dataset.parentName = parent.name;
    option.dataset.parentType = parent.type;
    option.dataset.parentRedaman = parent.redaman_in ?? '';
    option.dataset.parentSplitter = parent.splitter_ratio || '';
    option.dataset.parentRasioPorts = JSON.stringify(parent.rasio_redaman_ports || {});
    option.dataset.outputCount = String(parent.output_count || 0);
    option.dataset.usedPorts = JSON.stringify(parent.used_ports || []);
    option.className = 'block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-100 hover:text-slate-950';
    option.textContent = parent.name;

    return option;
}

function initializeParentCombobox(combobox) {
    if (combobox.dataset.parentComboboxReady === 'true') return;
    combobox.dataset.parentComboboxReady = 'true';

    const form = combobox.closest('form');
    const category = form?.querySelector('[data-parent-category]');
    const search = combobox.querySelector('[data-parent-search]');
    const parentInput = combobox.querySelector('[data-parent-id]');
    const dropdownButton = combobox.querySelector('[data-parent-dropdown-button]');
    const optionsPanel = combobox.querySelector('[data-parent-options]');
    const emptyMessage = combobox.querySelector('[data-parent-empty]');
    const portSelect = form?.querySelector('[data-port-select]');

    if (!form || !category || !search || !parentInput || !dropdownButton || !optionsPanel || !emptyMessage) return;

    let searchTimer;
    let requestController;

    // Bersihkan hasil lama sebelum menampilkan hasil pencarian API terbaru.
    const clearOptions = () => {
        optionsPanel.querySelectorAll('[data-parent-option]').forEach((option) => option.remove());
    };

    const showMessage = (message) => {
        clearOptions();
        emptyMessage.textContent = message;
        emptyMessage.classList.remove('hidden');
        optionsPanel.classList.remove('hidden');
    };

    const renderOptions = (parents) => {
        clearOptions();
        parents.forEach((parent) => optionsPanel.insertBefore(createParentOption(parent), emptyMessage));
        emptyMessage.textContent = 'Sumber jalur tidak ditemukan.';
        emptyMessage.classList.toggle('hidden', parents.length > 0);
        optionsPanel.classList.remove('hidden');
    };

    // Ambil maksimal 20 parent dari API setelah pengguna mengetik minimal dua karakter.
    const loadOptions = async () => {
        const keyword = search.value.trim();
        if (!category.value || keyword.length < minimumSearchLength) {
            showMessage('Ketik minimal 2 karakter.');
            return;
        }

        requestController?.abort();
        requestController = new AbortController();
        showMessage('Memuat sumber jalur...');

        const endpoint = new URL(combobox.dataset.parentApiUrl, window.location.origin);
        endpoint.searchParams.set('category', category.value);
        endpoint.searchParams.set('search', keyword);
        if (combobox.dataset.currentNodeId) endpoint.searchParams.set('current_node_id', combobox.dataset.currentNodeId);
        if (combobox.dataset.currentParentId) endpoint.searchParams.set('current_parent_id', combobox.dataset.currentParentId);

        try {
            const response = await apiFetch(endpoint, { signal: requestController.signal });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Sumber jalur gagal dimuat.');
            renderOptions(payload.data || []);
        } catch (error) {
            if (error.name !== 'AbortError') showMessage(error.message || 'Sumber jalur gagal dimuat.');
        }
    };

    const queueSearch = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadOptions, searchDelay);
    };

    const clearParent = () => {
        parentInput.value = '';
        search.value = '';
        search.setCustomValidity('');
        syncParentPort(combobox);
        form.dispatchEvent(new CustomEvent('maincore:parent-changed'));
    };

    const syncCategory = (resetParent = false) => {
        const enabled = Boolean(category.value);
        search.disabled = !enabled;
        dropdownButton.disabled = !enabled;
        search.placeholder = enabled ? 'Ketik minimal 2 karakter...' : 'Pilih kategori terlebih dahulu';

        if (resetParent) clearParent();
        optionsPanel.classList.add('hidden');
    };

    // Validasi port tetap memakai pesan bahasa Indonesia dari browser.
    portSelect?.addEventListener('invalid', () => portSelect.setCustomValidity('Port wajib dipilih.'));
    portSelect?.addEventListener('input', () => portSelect.setCustomValidity(''));
    portSelect?.addEventListener('change', () => portSelect.setCustomValidity(''));

    category.addEventListener('change', () => {
        requestController?.abort();
        syncCategory(true);
        if (!search.disabled) {
            search.focus();
            showMessage('Ketik minimal 2 karakter.');
        }
    });
    search.addEventListener('focus', () => {
        optionsPanel.classList.remove('hidden');
        if (search.value.trim().length >= minimumSearchLength) queueSearch();
        else showMessage('Ketik minimal 2 karakter.');
    });
    search.addEventListener('input', () => {
        parentInput.value = '';
        search.setCustomValidity('');
        syncParentPort(combobox);
        form.dispatchEvent(new CustomEvent('maincore:parent-changed'));
        queueSearch();
    });
    dropdownButton.addEventListener('click', () => {
        search.focus();
        if (search.value.trim().length >= minimumSearchLength) queueSearch();
    });
    optionsPanel.addEventListener('click', (event) => {
        const option = event.target.closest('[data-parent-option]');
        if (!option) return;

        parentInput.value = option.dataset.parentIdValue || '';
        search.value = option.dataset.parentName || '';
        search.setCustomValidity('');
        optionsPanel.classList.add('hidden');
        syncParentPort(combobox);
        form.dispatchEvent(new CustomEvent('maincore:parent-changed'));
    });
    form.addEventListener('submit', (event) => {
        if (parentInput.value) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        search.setCustomValidity('Pilih sumber jalur dari hasil pencarian.');
        search.reportValidity();
    }, true);

    syncCategory(false);
    syncParentPort(combobox);
}

export function bootParentComboboxes(container = document) {
    // Aktifkan combobox baru setelah modal atau fragment dimasukkan ke halaman.
    container.querySelectorAll('[data-parent-combobox]').forEach(initializeParentCombobox);

    if (outsideClickReady) return;
    outsideClickReady = true;

    // Tutup seluruh daftar parent ketika pengguna mengklik area di luar combobox.
    document.addEventListener('click', (event) => {
        document.querySelectorAll('[data-parent-combobox]').forEach((combobox) => {
            if (!combobox.contains(event.target)) {
                combobox.querySelector('[data-parent-options]')?.classList.add('hidden');
            }
        });
    });
}

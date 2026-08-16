function parsePorts(value) {
    try {
        return JSON.parse(value).map(Number);
    } catch {
        return [];
    }
}

function setSinglePortOption(portSelect, label) {
    portSelect.innerHTML = '';
    portSelect.disabled = true;
    portSelect.required = false;
    portSelect.appendChild(new Option(label, ''));
}

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
    const availablePorts = [];

    for (let port = 1; port <= outputCount; port++) {
        if (!usedPorts.includes(port) || port === currentPort) availablePorts.push(port);
    }

    if (availablePorts.length === 0) {
        setSinglePortOption(portSelect, 'Semua port sudah digunakan');
        return;
    }

    portSelect.innerHTML = '';
    portSelect.disabled = false;
    portSelect.required = true;
    portSelect.setCustomValidity('');
    portSelect.appendChild(new Option('Pilih port', ''));

    availablePorts.forEach((port) => {
        const option = new Option(`Port ${port}`, port);
        option.selected = port === currentPort;
        portSelect.appendChild(option);
    });
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
    const options = Array.from(combobox.querySelectorAll('[data-parent-option]'));
    const portSelect = form?.querySelector('[data-port-select]');

    if (!form || !category || !search || !parentInput || !dropdownButton || !optionsPanel || !emptyMessage) return;

    portSelect?.addEventListener('invalid', () => portSelect.setCustomValidity('Port wajib dipilih.'));
    portSelect?.addEventListener('input', () => portSelect.setCustomValidity(''));
    portSelect?.addEventListener('change', () => portSelect.setCustomValidity(''));

    const renderOptions = () => {
        if (!category.value || search.disabled) return;

        const keyword = search.value.trim().toLocaleLowerCase('id-ID');
        let visibleOptions = 0;

        options.forEach((option) => {
            const matchesCategory = option.dataset.parentType === category.value;
            const matchesKeyword = (option.dataset.parentName || '')
                .toLocaleLowerCase('id-ID')
                .includes(keyword);
            const visible = matchesCategory && matchesKeyword;

            option.classList.toggle('hidden', !visible);
            if (visible) visibleOptions++;
        });

        emptyMessage.textContent = keyword
            ? 'Sumber jalur tidak ditemukan.'
            : 'Belum ada sumber jalur pada kategori ini.';
        emptyMessage.classList.toggle('hidden', visibleOptions > 0);
        optionsPanel.classList.remove('hidden');
    };

    const clearParent = () => {
        parentInput.value = '';
        search.value = '';
        search.setCustomValidity('');
        syncParentPort(combobox);
    };

    const syncCategory = (resetParent = false) => {
        const enabled = Boolean(category.value);
        search.disabled = !enabled;
        dropdownButton.disabled = !enabled;
        search.placeholder = enabled ? 'Cari atau pilih sumber jalur...' : 'Pilih kategori terlebih dahulu';

        if (resetParent) clearParent();
        optionsPanel.classList.add('hidden');
    };

    category.addEventListener('change', () => {
        syncCategory(true);
        if (!search.disabled) {
            search.focus();
            renderOptions();
        }
    });
    search.addEventListener('focus', renderOptions);
    search.addEventListener('click', renderOptions);
    search.addEventListener('input', () => {
        parentInput.value = '';
        search.setCustomValidity('');
        syncParentPort(combobox);
        renderOptions();
    });
    dropdownButton.addEventListener('click', () => {
        search.focus();
        renderOptions();
    });
    options.forEach((option) => {
        option.addEventListener('click', () => {
            parentInput.value = option.dataset.parentIdValue || '';
            search.value = option.dataset.parentName || '';
            search.setCustomValidity('');
            optionsPanel.classList.add('hidden');
            syncParentPort(combobox);
        });
    });
    form.addEventListener('submit', (event) => {
        if (parentInput.value) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        search.setCustomValidity('Pilih sumber jalur dari daftar yang tersedia.');
        search.reportValidity();
    }, true);

    syncCategory(false);
    syncParentPort(combobox);
}

let outsideClickReady = false;

export function bootParentComboboxes(container = document) {
    const comboboxes = Array.from(container.querySelectorAll('[data-parent-combobox]'));
    comboboxes.forEach(initializeParentCombobox);

    if (outsideClickReady) return;
    outsideClickReady = true;

    document.addEventListener('click', (event) => {
        document.querySelectorAll('[data-parent-combobox]').forEach((combobox) => {
            if (!combobox.contains(event.target)) {
                combobox.querySelector('[data-parent-options]')?.classList.add('hidden');
            }
        });
    });
}

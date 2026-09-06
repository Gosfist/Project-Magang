export function bootTraceJalur() {
    const form = document.querySelector('[data-trace-form]');
    if (!form) return;

    let traceNodes = {};
    try {
        traceNodes = JSON.parse(form.dataset.traceNodes || '{}');
    } catch {
        traceNodes = {};
    }

    const category = form.querySelector('[data-trace-category]');
    const search = form.querySelector('[data-trace-search]');
    const nodeId = form.querySelector('[data-trace-node-id]');
    const options = form.querySelector('[data-trace-options]');
    const dropdownButton = form.querySelector('[data-trace-dropdown]');
    const nameField = form.querySelector('[data-trace-name-field]');

    const categoryNodes = () => traceNodes[category.value] || [];
    const selectNode = (node) => {
        search.value = node.nama_titik;
        nodeId.value = node.id;
        search.setCustomValidity('');
        options.classList.add('hidden');
    };
    const renderOptions = () => {
        const keyword = search.value.trim().toLocaleLowerCase('id-ID');
        const nodes = categoryNodes()
            .filter((node) => node.nama_titik.toLocaleLowerCase('id-ID').includes(keyword));

        options.innerHTML = '';
        if (nodes.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'px-3 py-2 text-sm text-gray-400';
            empty.textContent = keyword ? 'Nama tidak ditemukan.' : 'Belum ada data pada kategori ini.';
            options.appendChild(empty);
        } else {
            nodes.forEach((node) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-100 hover:text-slate-950';
                option.textContent = node.nama_titik;
                option.addEventListener('click', () => selectNode(node));
                options.appendChild(option);
            });
        }
        options.classList.remove('hidden');
    };
    const syncCategory = (resetSelection = false) => {
        const enabled = Boolean(category.value);
        search.disabled = !enabled;
        dropdownButton.disabled = !enabled;
        search.placeholder = enabled ? 'Cari atau pilih nama...' : 'Pilih kategori terlebih dahulu';

        if (resetSelection) {
            search.value = '';
            nodeId.value = '';
        }
        options.classList.add('hidden');
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
        nodeId.value = '';
        search.setCustomValidity('');
        renderOptions();
    });
    dropdownButton.addEventListener('click', () => {
        search.focus();
        renderOptions();
    });
    form.addEventListener('submit', (event) => {
        if (nodeId.value) return;
        event.preventDefault();
        search.setCustomValidity('Pilih nama dari daftar yang tersedia.');
        search.reportValidity();
    });
    document.addEventListener('click', (event) => {
        if (!nameField.contains(event.target)) options.classList.add('hidden');
    });

    syncCategory(false);
}

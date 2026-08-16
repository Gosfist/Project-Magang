function syncRasioRedamanPorts(splitterSelect) {
    const form = splitterSelect.closest('form');
    const wrapper = form?.querySelector('[data-rasio-redaman-wrapper]');
    if (!wrapper) return;

    const outputCount = Number((splitterSelect.value || '').replace('1:', '')) || 0;
    wrapper.classList.toggle('hidden', outputCount === 0);

    wrapper.querySelectorAll('[data-rasio-redaman-port]').forEach((field) => {
        const port = Number(field.dataset.rasioRedamanPort || 0);
        const input = field.querySelector('input');
        const visible = port > 0 && port <= outputCount;

        field.classList.toggle('hidden', !visible);
        if (input) {
            input.disabled = !visible;
            if (!visible) input.value = '';
        }
    });
}

export function bootSplitterFields(container) {
    container.querySelectorAll('[data-splitter-select]').forEach((splitterSelect) => {
        syncRasioRedamanPorts(splitterSelect);
        splitterSelect.addEventListener('change', () => syncRasioRedamanPorts(splitterSelect));
    });
}

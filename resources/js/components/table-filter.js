export function bootTableFilter(container) {
    const search = container.querySelector('[data-table-search]');
    if (!search) return;

    const rows = Array.from(container.querySelectorAll('[data-filter-row]'));
    const emptyResult = container.querySelector('[data-filter-empty]');
    const rowOffset = Number(container.dataset.rowOffset || 0);

    search.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase('id-ID');
        let visibleRows = 0;

        rows.forEach((row) => {
            const matches = (row.dataset.searchName || '').includes(query);
            row.classList.toggle('hidden', !matches);

            if (matches) {
                visibleRows++;
                const number = row.querySelector('[data-row-number]');
                if (number) number.textContent = rowOffset + visibleRows;
            }
        });

        emptyResult?.classList.toggle('hidden', query === '' || visibleRows > 0 || rows.length === 0);
    });
}

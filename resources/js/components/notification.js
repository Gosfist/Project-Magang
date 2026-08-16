export function showNotice(message, type = 'success') {
    const notice = document.createElement('div');
    const palette = type === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-green-200 bg-green-50 text-green-800';

    notice.className = `fixed bottom-4 right-4 z-[90] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-sm ${palette}`;
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 3500);
}

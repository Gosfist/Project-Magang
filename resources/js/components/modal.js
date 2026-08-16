const backdropId = 'modalBackdrop';

export function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (!document.getElementById(backdropId)) {
        const backdrop = document.createElement('div');
        backdrop.id = backdropId;
        backdrop.className = 'fixed inset-0 bg-black/50 backdrop-blur-[2px]';
        backdrop.style.zIndex = '9999';
        document.body.appendChild(backdrop);
    }

    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');

    if (!document.querySelector('[data-modal].flex')) {
        document.getElementById(backdropId)?.remove();
        document.body.classList.remove('overflow-hidden');
    }
}

export function bootModals() {
    document.addEventListener('click', (event) => {
        const openButton = event.target.closest('[data-open-modal]');
        if (openButton) {
            openModal(openButton.dataset.openModal);
            return;
        }

        const closeButton = event.target.closest('[data-close-modal]');
        if (closeButton) {
            closeModal(closeButton.dataset.closeModal);
        }
    });

    document.querySelectorAll('[data-modal-open-on-load]').forEach((modal) => openModal(modal.id));
}

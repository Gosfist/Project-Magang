import { accessTokenExpiresAt, accessTokenWasVerified, markAccessTokenVerified } from '../services/api';
import { currentUser, forgetAuthentication } from '../services/auth-service';

export function bootDashboard() {
    const dashboard = document.querySelector('[data-dashboard]');
    if (!dashboard) return;

    const logoutForm = document.querySelector('[data-logout-form]');
    let logoutStarted = false;

    const logout = () => {
        if (logoutStarted) return;
        logoutStarted = true;
        forgetAuthentication();

        if (logoutForm) {
            logoutForm.requestSubmit();
        } else {
            window.location.href = dashboard.dataset.loginUrl;
        }
    };

    window.addEventListener('auth:unauthorized', logout);

    document.querySelectorAll('[data-toggle-sidebar]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('-translate-x-full');
            document.getElementById('sidebarOverlay')?.classList.toggle('hidden');
        });
    });
    document.querySelector('[data-toggle-maincore-menu]')?.addEventListener('click', () => {
        document.getElementById('mainCoreMenu')?.classList.toggle('hidden');
        document.getElementById('mainCoreChevron')?.classList.toggle('-rotate-90');
    });
    document.querySelector('[data-toggle-tools-menu]')?.addEventListener('click', () => {
        document.getElementById('toolsMenu')?.classList.toggle('hidden');
        document.getElementById('toolsChevron')?.classList.toggle('-rotate-90');
    });
    document.querySelectorAll('[data-dismiss]').forEach((button) => {
        button.addEventListener('click', () => document.getElementById(button.dataset.dismiss)?.remove());
    });

    setTimeout(() => document.getElementById('global-flash')?.remove(), 5000);

    const remaining = accessTokenExpiresAt() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
        logout();
        return;
    }

    setTimeout(logout, remaining);
    // Token cukup diperiksa sekali pada kunjungan pertama setelah login.
    // Navigasi berikutnya memakai sesi yang sama tanpa meminta data pengguna berulang kali.
    if (accessTokenWasVerified()) return;

    currentUser(dashboard.dataset.meUrl).then((payload) => {
        if (!payload?.user) return;

        markAccessTokenVerified();
        document.getElementById('current-user-name').textContent = payload.user.name;
        document.getElementById('current-user-role').textContent = payload.user.role;
        document.getElementById('current-user-initial').textContent = payload.user.name.charAt(0).toUpperCase();
    }).catch(() => {});
}

import { bootModals } from './components/modal';
import { bootParentComboboxes } from './components/parent-combobox';
import { bootConfirmForms } from './components/confirm-form';
import { bootDashboard } from './pages/dashboard';
import { bootLogin } from './pages/login';
import { bootMainCore } from './pages/maincore';
import { bootPublicPages } from './pages/public';
import { bootTraceJalur } from './pages/trace-jalur';

function bootApplication() {
    bootDashboard();
    bootLogin();
    bootModals();
    bootConfirmForms();
    bootParentComboboxes();
    bootMainCore();
    bootTraceJalur();
    bootPublicPages();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApplication);
} else {
    bootApplication();
}

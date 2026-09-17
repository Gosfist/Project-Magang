import { Component, Input, OnChanges, OnDestroy, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, registerLocaleData } from '@angular/common';
import localeId from '@angular/common/locales/id';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
registerLocaleData(localeId);

interface DetailRow {
  id: string; reply?: string; authdate?: string; invoiceNumber?: string; amount?: string; dueDate?: string;
  status?: string; name?: string; notes?: string; promisedDate?: string; createdAt?: string;
}
@Component({
  selector: 'app-customer-services', standalone: true, imports: [FormsModule, DecimalPipe],
  templateUrl: './customer-services.component.html',
  styles: [`:host { display: block; } .detail-list { display: grid; gap: 8px; max-height: min(380px, 45dvh); overflow-y: auto; }
    .detail-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .detail-card p { overflow-wrap: anywhere; } .badge { border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; display:inline-block; }
    .entry { margin-top:12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; }
    .entry .input { margin-bottom: 10px; }`],
})
export class CustomerServicesComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) accountId = '';
  @Input({ required: true }) tab = '';
  readonly changed = output<{ isActive?: boolean }>();
  readonly busyChanged = output<boolean>();
  private api = inject(ApiService);
  private request?: Subscription;
  private mutation?: Subscription;
  rows = signal<DetailRow[]>([]);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  success = signal('');
  entryOpen = signal(false);
  confirmPayment = signal<DetailRow | null>(null);
  today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  form = { name: '', amount: null as number | null, dueDate: this.today, promisedDate: this.today, notes: '' };
  ngOnChanges() { this.entryOpen.set(false); this.confirmPayment.set(null); this.success.set(''); this.load(); }
  ngOnDestroy() { this.request?.unsubscribe(); this.mutation?.unsubscribe(); }
  private path() { return `/pppoe/accounts/${this.accountId}/${this.tab}`; }
  load() {
    this.request?.unsubscribe(); this.rows.set([]); this.error.set(''); this.loading.set(true);
    this.request = this.api.get<{ data: DetailRow[] }>(this.path()).subscribe({
      next: r => { this.rows.set(r.data); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); },
    });
  }
  date(value?: string, time = false) {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } as const : {}) }).format(new Date(value));
  }
  statusLabel(status?: string) { return ({ ACTIVE: 'Aktif', EXPIRED: 'Lewat janji', FULFILLED: 'Terpenuhi', CANCELLED: 'Dibatalkan' } as Record<string, string>)[status ?? ''] ?? status; }
  badge(status?: string) {
    return 'badge ' + (['PAID', 'FULFILLED', 'ACTIVE'].includes(status ?? '') ? 'bg-green-100 text-green-700' : ['OVERDUE', 'EXPIRED', 'CANCELLED'].includes(status ?? '') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
  }
  hasActivePromise() { return this.rows().some(row => row.status === 'ACTIVE'); }
  startEntry() {
    this.form = { name: '', amount: null, dueDate: this.today, promisedDate: this.today, notes: '' };
    this.error.set(''); this.success.set(''); this.entryOpen.set(true);
  }
  save(element: HTMLFormElement) {
    if (this.busy() || !element.reportValidity()) return;
    const body = this.tab === 'addons' ? { name: this.form.name.trim(), amount: this.form.amount, dueDate: this.form.dueDate, notes: this.form.notes } : { promisedDate: this.form.promisedDate, notes: this.form.notes };
    this.mutate(this.path(), body);
  }
  pay() {
    const invoice = this.confirmPayment();
    if (invoice) this.mutate(`/pppoe/accounts/${this.accountId}/invoices/${invoice.id}/pay`, {});
  }
  private mutate(path: string, body: unknown) {
    if (this.busy()) return;
    this.busy.set(true); this.busyChanged.emit(true); this.error.set(''); this.success.set('');
    this.mutation = this.api.post<{ message: string; isActive?: boolean }>(path, body).subscribe({
      next: r => { this.busy.set(false); this.busyChanged.emit(false); this.entryOpen.set(false); this.confirmPayment.set(null); this.success.set(r.message); this.load(); this.changed.emit(r); },
      error: e => { this.busy.set(false); this.busyChanged.emit(false); this.error.set(e.message); },
    });
  }
}

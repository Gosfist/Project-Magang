import { Component, Input, OnChanges, OnDestroy, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, registerLocaleData } from '@angular/common';
import localeId from '@angular/common/locales/id';
import { Subscription } from 'rxjs';
import { LucideBox, LucideX } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
registerLocaleData(localeId);

interface DetailRow {
  id: string; reply?: string; authdate?: string; invoiceNumber?: string; amount?: string; dueDate?: string;
  status?: string; name?: string; feeType?: string; notes?: string; promisedDate?: string; createdAt?: string;
}
@Component({
  selector: 'app-customer-services', standalone: true, imports: [FormsModule, DecimalPipe, LucideBox, LucideX],
  templateUrl: './customer-services.component.html',
  styles: [`:host { display: block; } .detail-list { display: grid; gap: 8px; max-height: min(380px, 45dvh); overflow-y: auto; }
    .detail-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .detail-card p { overflow-wrap: anywhere; } .badge { border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; display:inline-block; }
    .entry { margin-top:12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; }
    .entry .input { margin-bottom: 10px; }
    .service-dialog { margin-inline: auto; max-width: 492px; border-radius: 16px; border: 1px solid #dbe3ee; background: #fff; padding: 22px 26px; box-shadow: 0 18px 44px rgba(15, 23, 42, .16); }
    .service-title { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px; }
    .fee-toggle { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:18px; }
    .fee-toggle label { cursor:pointer; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center; font-size:13px; font-weight:600; color:#475569; }
    .fee-toggle label.active { border-color:#4f46e5; background:#eef2ff; color:#4338ca; box-shadow: inset 0 0 0 1px #4f46e5; }
    .service-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    @media (max-width: 520px) { .service-dialog { padding:18px; } .service-actions { grid-template-columns:1fr; } }`],
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
  form = { name: '', amount: null as number | null, feeType: 'MONTHLY', dueDate: this.today, promisedDate: this.today, notes: '' };
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
  // Kode balasan RADIUS dan status tagihan tetap dipakai untuk logika; hanya tampilannya yang diterjemahkan.
  authLabel(reply?: string) { return ({ 'Access-Accept': 'Akses diterima', 'Access-Reject': 'Akses ditolak', 'Access-Challenge': 'Verifikasi lanjutan' } as Record<string, string>)[reply ?? ''] ?? reply ?? 'Tidak diketahui'; }
  invoiceLabel(status?: string) { return ({ PAID: 'Lunas', PENDING: 'Menunggu pembayaran', OVERDUE: 'Lewat jatuh tempo', CANCELLED: 'Dibatalkan' } as Record<string, string>)[status ?? ''] ?? status ?? 'Tidak diketahui'; }
  feeLabel(feeType?: string) { return feeType === 'MONTHLY' ? 'Bulanan' : 'Sekali bayar'; }
  badge(status?: string) {
    return 'badge ' + (['PAID', 'FULFILLED', 'ACTIVE'].includes(status ?? '') ? 'bg-green-100 text-green-700' : ['OVERDUE', 'EXPIRED', 'CANCELLED'].includes(status ?? '') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
  }
  hasActivePromise() { return this.rows().some(row => row.status === 'ACTIVE'); }
  startEntry() {
    this.form = { name: '', amount: null, feeType: 'MONTHLY', dueDate: this.today, promisedDate: this.today, notes: '' };
    this.error.set(''); this.success.set(''); this.entryOpen.set(true);
  }
  save(element: HTMLFormElement) {
    if (this.busy() || !element.reportValidity()) return;
    const body = this.tab === 'addons' ? { name: this.form.name.trim(), amount: this.form.amount, feeType: this.form.feeType, dueDate: this.form.dueDate, notes: this.form.notes } : { promisedDate: this.form.promisedDate, notes: this.form.notes };
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

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CollectorDeposit, PageMeta } from '../../../../shared/models/types';

@Component({
  selector: 'app-finance-deposits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900">Setoran Pengepul</h1>
        @if (auth.hasRole('admin', 'pengepul')) {
          <button (click)="openCreateModal()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Catat Setoran</button>
        }
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <input type="text" placeholder="Cari pelanggan..." [(ngModel)]="search" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56" />
        <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Semua Status</option>
          <option value="PENDING">Menunggu ACC</option>
          <option value="ACCEPTED">Diterima</option>
          <option value="REJECTED">Ditolak</option>
        </select>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Tanggal</th>
              <th class="px-4 py-3 font-medium text-slate-600">Pelanggan</th>
              <th class="px-4 py-3 font-medium text-slate-600">Area</th>
              <th class="px-4 py-3 font-medium text-slate-600">Pengepul</th>
              <th class="px-4 py-3 font-medium text-slate-600">No. Tagihan</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Jumlah</th>
              <th class="px-4 py-3 font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 font-medium text-slate-600">Catatan</th>
              @if (auth.hasRole('admin', 'finance')) {
                <th class="px-4 py-3 font-medium text-slate-600">Aksi</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (loading()) {
              <tr><td colspan="9" class="px-4 py-8 text-center text-slate-400">Memuat data...</td></tr>
            } @else if (deposits().length === 0) {
              <tr><td colspan="9" class="px-4 py-8 text-center text-slate-400">Belum ada setoran.</td></tr>
            } @else {
              @for (d of deposits(); track d.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3 whitespace-nowrap">{{ formatDate(d.depositDate) }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-slate-900">{{ d.account?.customerName || '-' }}</div>
                    <div class="text-xs text-slate-400">{{ d.account?.username }} (ID: {{ d.account?.customerNumber }})</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{{ d.account?.area?.name || 'Tanpa Area' }}</span>
                  </td>
                  <td class="px-4 py-3">{{ d.collector?.name || '-' }}</td>
                  <td class="px-4 py-3 text-xs font-mono">{{ d.invoice?.invoiceNumber || '-' }}</td>
                  <td class="px-4 py-3 text-right font-medium text-slate-900">{{ formatCurrency(d.amount) }}</td>
                  <td class="px-4 py-3">
                    <span [class]="statusClass(d.status)">{{ statusLabel(d.status) }}</span>
                  </td>
                  <td class="px-4 py-3 max-w-xs truncate text-slate-500">{{ d.notes || '-' }}</td>
                  @if (auth.hasRole('admin', 'finance')) {
                    <td class="px-4 py-3">
                      @if (d.status === 'PENDING') {
                        <div class="flex gap-1">
                          <button (click)="accept(d)" class="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">ACC</button>
                          <button (click)="reject(d)" class="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Tolak</button>
                        </div>
                      } @else {
                        <span class="text-xs text-slate-400">{{ d.acceptedBy?.name || '-' }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (meta()) {
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Halaman {{ meta()!.currentPage }} dari {{ meta()!.lastPage }} ({{ meta()!.total }} setoran)</p>
          <div class="flex gap-2">
            <button [disabled]="page === 1" (click)="page = page - 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Sebelumnya</button>
            <button [disabled]="page >= (meta()?.lastPage || 1)" (click)="page = page + 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Selanjutnya</button>
          </div>
        </div>
      }
    </div>

    <!-- Create Deposit Modal -->
    @if (createModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="createModalOpen.set(false)">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold text-slate-900 mb-4">Catat Setoran Pelanggan</h2>
          <form (submit)="saveDeposit($event)" class="space-y-4">
            <!-- Search & Select Unpaid Invoice -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Pilih Tagihan Pelanggan</label>
              @if (!selectedInvoice) {
                <div class="space-y-2">
                  <input
                    type="text"
                    placeholder="Cari nama, no. pelanggan, username..."
                    [(ngModel)]="invoiceSearch"
                    name="invoiceSearch"
                    (ngModelChange)="loadUnpaidInvoices()"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div class="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    @if (loadingInvoices()) {
                      <p class="p-3 text-center text-xs text-slate-400">Mencari tagihan belum lunas...</p>
                    } @else if (unpaidInvoices().length === 0) {
                      <p class="p-3 text-center text-xs text-slate-400">Tidak ada tagihan belum lunas ditemukan.</p>
                    } @else {
                      @for (inv of unpaidInvoices(); track inv.id) {
                        <button
                          type="button"
                          (click)="selectInvoice(inv)"
                          class="w-full text-left p-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p class="text-sm font-medium text-slate-900">{{ inv.account?.customerName }} ({{ inv.account?.username }})</p>
                            <p class="text-xs text-slate-400">
                              No. Tagihan: {{ inv.invoiceNumber }} • Area: {{ inv.account?.area?.name || 'Tanpa Area' }}
                            </p>
                          </div>
                          <span class="text-sm font-bold text-blue-600">{{ formatCurrency(inv.amount) }}</span>
                        </button>
                      }
                    }
                  </div>
                </div>
              } @else {
                <div class="rounded-lg border border-blue-200 bg-blue-50/50 p-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">{{ selectedInvoice.account?.customerName }}</p>
                    <p class="text-xs text-slate-500">
                      No. Tagihan: {{ selectedInvoice.invoiceNumber }} • Area: {{ selectedInvoice.account?.area?.name || 'Tanpa Area' }}
                    </p>
                  </div>
                  <button type="button" (click)="selectedInvoice = null" class="text-xs font-medium text-blue-600 hover:underline">Ganti</button>
                </div>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Jumlah Setor (Rp)</label>
              <input type="number" [(ngModel)]="depositForm.amount" name="amount" required min="1" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Setor</label>
              <input type="date" [(ngModel)]="depositForm.depositDate" name="depositDate" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
              <input type="text" [(ngModel)]="depositForm.notes" name="notes" placeholder="Cth: Titip bayar via transfer/tunai" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" (click)="createModalOpen.set(false)" class="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button type="submit" [disabled]="saving() || !depositForm.invoiceId" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {{ saving() ? 'Menyimpan...' : 'Simpan Setoran' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class FinanceDepositsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  createModalOpen = signal(false);
  deposits = signal<CollectorDeposit[]>([]);
  meta = signal<PageMeta | null>(null);

  search = '';
  filterStatus = '';
  page = 1;

  depositForm = { pppoeAccountId: '', invoiceId: '', amount: 0, depositDate: new Date().toISOString().slice(0, 10), notes: '' };
  unpaidInvoices = signal<any[]>([]);
  loadingInvoices = signal(false);
  invoiceSearch = '';
  selectedInvoice: any = null;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.filterStatus) params.set('status', this.filterStatus);
    params.set('page', String(this.page));

    this.api.get<{ data: CollectorDeposit[]; meta: PageMeta }>(`/finance/deposits?${params}`).subscribe({
      next: (res) => { this.deposits.set(res.data); this.meta.set(res.meta); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreateModal() {
    this.selectedInvoice = null;
    this.invoiceSearch = '';
    this.depositForm = { pppoeAccountId: '', invoiceId: '', amount: 0, depositDate: new Date().toISOString().slice(0, 10), notes: '' };
    this.createModalOpen.set(true);
    this.loadUnpaidInvoices();
  }

  loadUnpaidInvoices() {
    this.loadingInvoices.set(true);
    const params = new URLSearchParams();
    if (this.invoiceSearch.trim()) params.set('search', this.invoiceSearch.trim());
    this.api.get<{ data: any[] }>(`/finance/deposits/unpaid-invoices?${params}`).subscribe({
      next: (res) => { this.unpaidInvoices.set(res.data); this.loadingInvoices.set(false); },
      error: () => this.loadingInvoices.set(false),
    });
  }

  selectInvoice(inv: any) {
    this.selectedInvoice = inv;
    this.depositForm.pppoeAccountId = String(inv.account?.id || '');
    this.depositForm.invoiceId = String(inv.id);
    this.depositForm.amount = inv.amount;
  }

  saveDeposit(event: Event) {
    event.preventDefault();
    if (!this.depositForm.invoiceId || !this.depositForm.pppoeAccountId) return;
    this.saving.set(true);
    this.api.post('/finance/deposits', this.depositForm).subscribe({
      next: () => { this.saving.set(false); this.createModalOpen.set(false); this.load(); },
      error: (err) => { alert(err.message || 'Gagal mencatat setoran'); this.saving.set(false); },
    });
  }

  accept(d: CollectorDeposit) {
    if (!confirm(`ACC setoran dari pengepul ${d.collector?.name} untuk pelanggan ${d.account?.customerName}?`)) return;
    this.api.patch(`/finance/deposits/${d.id}/accept`, {}).subscribe({ next: () => this.load() });
  }

  reject(d: CollectorDeposit) {
    const reason = prompt('Alasan penolakan (opsional):');
    this.api.patch(`/finance/deposits/${d.id}/reject`, { reason: reason || '' }).subscribe({ next: () => this.load() });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700';
      case 'ACCEPTED': return 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700';
      case 'REJECTED': return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700';
      default: return '';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Menunggu ACC';
      case 'ACCEPTED': return 'Diterima';
      case 'REJECTED': return 'Ditolak';
      default: return status;
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(date));
  }
}

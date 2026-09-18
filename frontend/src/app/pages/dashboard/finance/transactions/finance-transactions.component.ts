import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceTransaction, PageMeta } from '../../../../shared/models/types';

@Component({
  selector: 'app-finance-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900">Transaksi Keuangan</h1>
        <button (click)="openModal()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Tambah Transaksi</button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <input type="text" placeholder="Cari deskripsi..." [(ngModel)]="search" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56" />
        <select [(ngModel)]="filterType" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Semua Tipe</option>
          <option value="INCOME">Pemasukan</option>
          <option value="EXPENSE">Pengeluaran</option>
        </select>
        <input type="date" [(ngModel)]="startDate" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" [(ngModel)]="endDate" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Tanggal</th>
              <th class="px-4 py-3 font-medium text-slate-600">Tipe</th>
              <th class="px-4 py-3 font-medium text-slate-600">Kategori</th>
              <th class="px-4 py-3 font-medium text-slate-600">Deskripsi</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Jumlah</th>
              <th class="px-4 py-3 font-medium text-slate-600">Dibuat Oleh</th>
              <th class="px-4 py-3 font-medium text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @if (loading()) {
              <tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Memuat data...</td></tr>
            } @else if (transactions().length === 0) {
              <tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Belum ada transaksi.</td></tr>
            } @else {
              @for (t of transactions(); track t.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3 whitespace-nowrap">{{ formatDate(t.transactionDate) }}</td>
                  <td class="px-4 py-3">
                    <span [class]="t.type === 'INCOME' ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700' : 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700'">
                      {{ t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">{{ t.category }}</td>
                  <td class="px-4 py-3 max-w-xs truncate">{{ t.description }}</td>
                  <td class="px-4 py-3 text-right font-medium" [class]="t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'">{{ formatCurrency(t.amount) }}</td>
                  <td class="px-4 py-3 text-slate-500">{{ t.createdBy?.name || '-' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button (click)="openModal(t)" class="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                      <button (click)="remove(t)" class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Hapus</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (meta()) {
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Halaman {{ meta()!.currentPage }} dari {{ meta()!.lastPage }} ({{ meta()!.total }} transaksi)</p>
          <div class="flex gap-2">
            <button [disabled]="page === 1" (click)="page = page - 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Sebelumnya</button>
            <button [disabled]="page >= (meta()?.lastPage || 1)" (click)="page = page + 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Selanjutnya</button>
          </div>
        </div>
      }
    </div>

    <!-- Modal -->
    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeModal()">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold text-slate-900 mb-4">{{ editing ? 'Edit' : 'Tambah' }} Transaksi</h2>
          <form (submit)="save($event)" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
                <select [(ngModel)]="form.type" name="type" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="INCOME">Pemasukan</option>
                  <option value="EXPENSE">Pengeluaran</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                <input type="text" [(ngModel)]="form.category" name="category" required placeholder="Cth: OPERASIONAL" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Jumlah (Rp)</label>
              <input type="number" [(ngModel)]="form.amount" name="amount" required min="1" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
              <input type="text" [(ngModel)]="form.description" name="description" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
              <input type="date" [(ngModel)]="form.transactionDate" name="transactionDate" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" (click)="closeModal()" class="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button type="submit" [disabled]="saving()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {{ saving() ? 'Menyimpan...' : 'Simpan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class FinanceTransactionsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  modalOpen = signal(false);
  transactions = signal<FinanceTransaction[]>([]);
  meta = signal<PageMeta | null>(null);

  search = '';
  filterType = '';
  startDate = '';
  endDate = '';
  page = 1;
  editing: FinanceTransaction | null = null;

  form = { type: 'INCOME', category: '', amount: 0, description: '', transactionDate: new Date().toISOString().slice(0, 10) };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.filterType) params.set('type', this.filterType);
    if (this.startDate) params.set('startDate', this.startDate);
    if (this.endDate) params.set('endDate', this.endDate);
    params.set('page', String(this.page));

    this.api.get<{ data: FinanceTransaction[]; meta: PageMeta }>(`/finance/transactions?${params}`).subscribe({
      next: (res) => { this.transactions.set(res.data); this.meta.set(res.meta); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openModal(t?: FinanceTransaction) {
    this.editing = t || null;
    this.form = t
      ? { type: t.type, category: t.category, amount: t.amount, description: t.description, transactionDate: t.transactionDate.slice(0, 10) }
      : { type: 'INCOME', category: '', amount: 0, description: '', transactionDate: new Date().toISOString().slice(0, 10) };
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); this.editing = null; }

  save(event: Event) {
    event.preventDefault();
    this.saving.set(true);
    const obs = this.editing
      ? this.api.patch(`/finance/transactions/${this.editing.id}`, this.form)
      : this.api.post('/finance/transactions', this.form);
    obs.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  remove(t: FinanceTransaction) {
    if (!confirm(`Hapus transaksi "${t.description}"?`)) return;
    this.api.delete(`/finance/transactions/${t.id}`).subscribe({ next: () => this.load() });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(date));
  }
}

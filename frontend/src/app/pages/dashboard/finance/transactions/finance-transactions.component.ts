import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideSearch,
  LucidePlus,
  LucidePencil,
  LucideTrash2,
  LucideRotateCcw,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceTransaction, PageMeta } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-finance-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
    LucideSearch,
    LucidePlus,
    LucidePencil,
    LucideTrash2,
    LucideRotateCcw,
  ],
  templateUrl: './finance-transactions.component.html',
  styleUrl: './finance-transactions.component.css',
})
export class FinanceTransactionsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  modalOpen = signal(false);
  transactions = signal<FinanceTransaction[]>([]);
  meta = signal<PageMeta | null>(null);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  search = '';
  filterType = '';
  startDate = '';
  endDate = '';
  page = signal(1);
  editing: FinanceTransaction | null = null;

  form = {
    type: 'INCOME',
    category: '',
    amount: 0,
    description: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  };

  ngOnInit() {
    this.load();
  }

  resetFilters() {
    this.search = '';
    this.filterType = '';
    this.startDate = '';
    this.endDate = '';
    this.page.set(1);
    this.load();
  }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.filterType) params.set('type', this.filterType);
    if (this.startDate) params.set('startDate', this.startDate);
    if (this.endDate) params.set('endDate', this.endDate);
    params.set('page', String(this.page()));

    this.api
      .get<{ data: FinanceTransaction[]; meta: PageMeta }>(`/finance/transactions?${params}`)
      .subscribe({
        next: (res) => {
          this.transactions.set(res.data);
          this.meta.set(res.meta);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.set({ message: err.message || 'Gagal memuat transaksi', type: 'error' });
        },
      });
  }

  openModal(t?: FinanceTransaction) {
    this.editing = t || null;
    this.form = t
      ? {
          type: t.type,
          category: t.category,
          amount: t.amount,
          description: t.description,
          transactionDate: t.transactionDate.slice(0, 10),
        }
      : {
          type: 'INCOME',
          category: '',
          amount: 0,
          description: '',
          transactionDate: new Date().toISOString().slice(0, 10),
        };
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editing = null;
  }

  save(event: Event) {
    event.preventDefault();
    if (!this.form.description.trim() || !this.form.amount || !this.form.category.trim()) return;
    this.saving.set(true);
    const obs = this.editing
      ? this.api.patch(`/finance/transactions/${this.editing.id}`, this.form)
      : this.api.post('/finance/transactions', this.form);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.set({
          message: `Transaksi berhasil ${this.editing ? 'diperbarui' : 'dicatat'}.`,
          type: 'success',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.set({ message: err.message || 'Gagal menyimpan transaksi', type: 'error' });
      },
    });
  }

  remove(t: FinanceTransaction) {
    if (!confirm(`Hapus catatan transaksi "${t.description}"?`)) return;
    this.api.delete(`/finance/transactions/${t.id}`).subscribe({
      next: () => {
        this.toast.set({ message: 'Transaksi berhasil dihapus.', type: 'success' });
        this.load();
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal menghapus transaksi', type: 'error' });
      },
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(date));
  }

  formatCategory(cat?: string): string {
    if (!cat) return '-';
    if (cat === 'SETORAN_KOLEKTOR') return 'Setoran Kolektor';
    return cat;
  }

  formatReference(ref?: string): string {
    if (!ref) return '-';
    if (ref === 'DEPOSIT') return 'Setoran Kolektor';
    return ref;
  }
}

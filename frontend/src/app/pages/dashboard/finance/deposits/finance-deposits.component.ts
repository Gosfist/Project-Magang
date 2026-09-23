import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideSearch,
  LucidePlus,
  LucideCheck,
  LucideX,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CollectorDeposit, PageMeta } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-finance-deposits',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
    LucideSearch,
    LucidePlus,
    LucideCheck,
    LucideX,
  ],
  templateUrl: './finance-deposits.component.html',
  styleUrl: './finance-deposits.component.css',
})
export class FinanceDepositsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  rejecting = signal(false);
  createModalOpen = signal(false);
  rejectModalOpen = signal(false);
  deposits = signal<CollectorDeposit[]>([]);
  meta = signal<PageMeta | null>(null);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  search = '';
  filterStatus = '';
  page = signal(1);

  depositForm = {
    pppoeAccountId: '',
    invoiceId: '',
    amount: 0,
    depositDate: new Date().toISOString().slice(0, 10),
  };
  unpaidInvoices = signal<any[]>([]);
  loadingInvoices = signal(false);
  invoiceSearch = '';
  selectedInvoice: any = null;

  rejectingDeposit: CollectorDeposit | null = null;
  rejectReason = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.filterStatus) params.set('status', this.filterStatus);
    params.set('page', String(this.page()));

    this.api
      .get<{ data: CollectorDeposit[]; meta: PageMeta }>(`/finance/deposits?${params}`)
      .subscribe({
        next: (res) => {
          this.deposits.set(res.data);
          this.meta.set(res.meta);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.set({ message: err.message || 'Gagal memuat data setoran', type: 'error' });
        },
      });
  }

  openCreateModal() {
    this.selectedInvoice = null;
    this.invoiceSearch = '';
    this.depositForm = {
      pppoeAccountId: '',
      invoiceId: '',
      amount: 0,
      depositDate: new Date().toISOString().slice(0, 10),
    };
    this.createModalOpen.set(true);
    this.loadUnpaidInvoices();
  }

  loadUnpaidInvoices() {
    this.loadingInvoices.set(true);
    const params = new URLSearchParams();
    if (this.invoiceSearch.trim()) params.set('search', this.invoiceSearch.trim());
    this.api.get<{ data: any[] }>(`/finance/deposits/unpaid-invoices?${params}`).subscribe({
      next: (res) => {
        this.unpaidInvoices.set(res.data);
        this.loadingInvoices.set(false);
      },
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
    this.api.post<{ message: string; whatsappNotified?: boolean }>('/finance/deposits', this.depositForm).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.createModalOpen.set(false);
        this.toast.set({
          message: result.message,
          type: result.whatsappNotified === false ? 'error' : 'success',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.set({ message: err.message || 'Gagal mencatat setoran', type: 'error' });
      },
    });
  }

  accept(d: CollectorDeposit) {
    if (!confirm(`ACC setoran dari kolektor ${d.collector?.name} untuk pelanggan ${d.account?.customerName}? Tagihan akan otomatis lunas dan tercatat di pemasukan kas.`)) return;
    this.api.patch(`/finance/deposits/${d.id}/accept`, {}).subscribe({
      next: () => {
        this.toast.set({ message: 'Setoran berhasil di-ACC dan dicatat ke pembukuan kas.', type: 'success' });
        this.load();
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal ACC setoran', type: 'error' });
      },
    });
  }

  openRejectModal(d: CollectorDeposit) {
    this.rejectingDeposit = d;
    this.rejectReason = '';
    this.rejectModalOpen.set(true);
  }

  confirmReject() {
    if (!this.rejectingDeposit) return;
    this.rejecting.set(true);
    this.api
      .patch(`/finance/deposits/${this.rejectingDeposit.id}/reject`, { reason: this.rejectReason.trim() })
      .subscribe({
        next: () => {
          this.rejecting.set(false);
          this.rejectModalOpen.set(false);
          this.toast.set({ message: 'Setoran berhasil ditolak.', type: 'success' });
          this.load();
        },
        error: (err) => {
          this.rejecting.set(false);
          this.toast.set({ message: err.message || 'Gagal menolak setoran', type: 'error' });
        },
      });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Menunggu ACC';
      case 'ACCEPTED':
        return 'Diterima';
      case 'REJECTED':
        return 'Ditolak';
      default:
        return status;
    }
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
}

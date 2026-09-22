import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideSearch,
  LucidePlus,
  LucidePencil,
  LucideTrash2,
  LucideMapPin,
  LucideUserPlus,
  LucideX,
  LucideArrowLeft,
  LucideUsers,
  LucideCheckCircle2,
  LucideAlertCircle,
  LucideClock,
  LucideDollarSign,
  LucideSend,
} from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Area,
  AreaBillingSummary,
  AreaCustomer,
  PageMeta,
} from '../../../shared/models/types';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-area',
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
    LucideMapPin,
    LucideUserPlus,
    LucideX,
    LucideArrowLeft,
    LucideUsers,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideClock,
    LucideDollarSign,
    LucideSend,
  ],
  templateUrl: './area.component.html',
  styleUrl: './area.component.css',
})
export class AreaComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  // View Mode: 'list' (Tabel Area) | 'detail' (Daftar Penagihan Pelanggan Area)
  viewMode = signal<'list' | 'detail'>('list');

  loading = signal(true);
  saving = signal(false);
  assigning = signal(false);
  modalOpen = signal(false);
  assignModalOpen = signal(false);
  areas = signal<Area[]>([]);
  meta = signal<PageMeta | null>(null);
  collectorOptions = signal<{ id: string; name: string; email: string }[]>([]);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  search = '';
  page = signal(1);
  editing: Area | null = null;
  assignArea: Area | null = null;
  selectedCollectorId = '';
  form = { name: '', description: '', collectorUserId: '' };

  // Area Detail & Customer Billing State
  selectedArea = signal<Area | null>(null);
  areaSummary = signal<AreaBillingSummary | null>(null);
  customers = signal<AreaCustomer[]>([]);
  loadingCustomers = signal(false);
  customerSearch = '';
  customerStatusFilter = signal<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Quick Deposit modal state
  quickDepositModalOpen = signal(false);
  depositTargetCustomer: AreaCustomer | null = null;
  quickDepositForm = {
    amount: 0,
    depositDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };
  submittingDeposit = signal(false);

  ngOnInit() {
    if (this.auth.isKolektor()) {
      this.viewMode.set('detail');
      this.selectedArea.set({
        id: 'collector-all',
        name: 'Daftar Tagihan',
        description: 'Gabungan seluruh pelanggan dari area yang ditugaskan.',
      });
      this.loadCollectorCustomers();
      return;
    }

    this.load();
    this.loadCollectorOptions();
  }

  loadCollectorOptions() {
    this.api.get<{ data: { id: string; name: string; email: string }[] }>('/areas/collector-options').subscribe({
      next: (res) => this.collectorOptions.set(res.data),
      error: () => {},
    });
  }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    params.set('page', String(this.page()));

    this.api.get<{ data: Area[]; meta: PageMeta }>(`/areas?${params}`).subscribe({
      next: (res) => {
        this.areas.set(res.data);
        this.meta.set(res.meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.set({ message: err.message || 'Gagal memuat data area', type: 'error' });
      },
    });
  }

  openModal(area?: Area) {
    this.editing = area || null;
    this.form = area
      ? { name: area.name, description: area.description || '', collectorUserId: '' }
      : { name: '', description: '', collectorUserId: '' };
    this.loadCollectorOptions();
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editing = null;
  }

  save(event: Event) {
    event.preventDefault();
    if (!this.form.name.trim()) return;
    this.saving.set(true);
    const obs = this.editing
      ? this.api.patch(`/areas/${this.editing.id}`, this.form)
      : this.api.post('/areas', this.form);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.set({
          message: `Area berhasil ${this.editing ? 'diperbarui' : 'ditambahkan'}.`,
          type: 'success',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.set({ message: err.message || 'Gagal menyimpan area', type: 'error' });
      },
    });
  }

  remove(area: Area) {
    if (!confirm(`Hapus area "${area.name}"? Pelanggan di area ini akan menjadi tanpa area.`)) return;
    this.api.delete(`/areas/${area.id}`).subscribe({
      next: () => {
        this.toast.set({ message: `Area "${area.name}" berhasil dihapus.`, type: 'success' });
        this.load();
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal menghapus area', type: 'error' });
      },
    });
  }

  openAssignModal(area: Area) {
    this.assignArea = area;
    this.selectedCollectorId = '';
    this.api.get<{ data: { id: string; name: string; email: string }[] }>('/areas/collector-options').subscribe({
      next: (res) => {
        const assignedIds = new Set(area.collectors?.map((c) => String(c.userId)) || []);
        this.collectorOptions.set(res.data.filter((c) => !assignedIds.has(String(c.id))));
        this.assignModalOpen.set(true);
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal memuat opsi kolektor', type: 'error' });
      },
    });
  }

  assignCollector() {
    if (!this.assignArea || !this.selectedCollectorId) return;
    this.assigning.set(true);
    this.api.post(`/areas/${this.assignArea.id}/collectors`, { userId: this.selectedCollectorId }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignModalOpen.set(false);
        this.toast.set({ message: 'Kolektor berhasil ditugaskan ke area.', type: 'success' });
        this.load();
        if (this.viewMode() === 'detail' && this.selectedArea()?.id === this.assignArea?.id) {
          this.loadAreaCustomers();
        }
      },
      error: (err) => {
        this.assigning.set(false);
        this.toast.set({ message: err.message || 'Gagal menugaskan kolektor', type: 'error' });
      },
    });
  }

  removeCollector(area: Area, userId: string) {
    if (!confirm('Hapus penugasan kolektor ini dari area?')) return;
    this.api.delete(`/areas/${area.id}/collectors/${userId}`).subscribe({
      next: () => {
        this.toast.set({ message: 'Kolektor berhasil dilepas dari area.', type: 'success' });
        this.load();
        if (this.viewMode() === 'detail' && this.selectedArea()?.id === area.id) {
          this.loadAreaCustomers();
        }
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal melepas kolektor', type: 'error' });
      },
    });
  }

  // === Detail Penagihan Pelanggan Area ===
  openAreaDetail(area: Area) {
    this.selectedArea.set(area);
    this.viewMode.set('detail');
    this.customerStatusFilter.set('ALL');
    this.customerSearch = '';
    this.loadAreaCustomers();
  }

  backToList() {
    this.viewMode.set('list');
    this.selectedArea.set(null);
    this.load();
  }

  setCustomerFilter(status: 'ALL' | 'UNPAID' | 'PAID') {
    this.customerStatusFilter.set(status);
    this.loadAreaCustomers();
  }

  loadAreaCustomers() {
    if (this.auth.isKolektor()) {
      this.loadCollectorCustomers();
      return;
    }

    const current = this.selectedArea();
    if (!current) return;
    this.loadingCustomers.set(true);

    const params = new URLSearchParams();
    if (this.customerSearch.trim()) params.set('search', this.customerSearch.trim());
    params.set('status', this.customerStatusFilter());

    this.api
      .get<{
        area: Area;
        summary: AreaBillingSummary;
        customers: AreaCustomer[];
      }>(`/areas/${current.id}/customers?${params}`)
      .subscribe({
        next: (res) => {
          this.selectedArea.set(res.area);
          this.areaSummary.set(res.summary);
          this.customers.set(res.customers);
          this.loadingCustomers.set(false);
        },
        error: (err) => {
          this.loadingCustomers.set(false);
          this.toast.set({ message: err.message || 'Gagal memuat data pelanggan area', type: 'error' });
        },
      });
  }

  loadCollectorCustomers() {
    this.loadingCustomers.set(true);

    const params = new URLSearchParams();
    if (this.customerSearch.trim()) params.set('search', this.customerSearch.trim());
    params.set('status', this.customerStatusFilter());

    this.api
      .get<{
        area: Area;
        summary: AreaBillingSummary;
        customers: AreaCustomer[];
      }>(`/areas/customers?${params}`)
      .subscribe({
        next: (res) => {
          this.selectedArea.set(res.area);
          this.areaSummary.set(res.summary);
          this.customers.set(res.customers);
          this.loadingCustomers.set(false);
        },
        error: (err) => {
          this.loadingCustomers.set(false);
          this.toast.set({ message: err.message || 'Gagal memuat daftar tagihan', type: 'error' });
        },
      });
  }

  // === Quick Deposit dari Daftar Pelanggan ===
  openQuickDeposit(customer: AreaCustomer) {
    if (!customer.activeInvoice) {
      this.toast.set({ message: 'Pelanggan tidak memiliki tagihan aktif untuk dibayar.', type: 'error' });
      return;
    }
    this.depositTargetCustomer = customer;
    this.quickDepositForm = {
      amount: customer.activeInvoice.amount,
      depositDate: new Date().toISOString().slice(0, 10),
      notes: '',
    };
    this.quickDepositModalOpen.set(true);
  }

  closeQuickDeposit() {
    this.quickDepositModalOpen.set(false);
    this.depositTargetCustomer = null;
  }

  saveQuickDeposit(event: Event) {
    event.preventDefault();
    if (!this.depositTargetCustomer?.activeInvoice || this.quickDepositForm.amount <= 0) return;

    this.submittingDeposit.set(true);
    const payload = {
      pppoeAccountId: this.depositTargetCustomer.id,
      invoiceId: this.depositTargetCustomer.activeInvoice.id,
      amount: this.quickDepositForm.amount,
      depositDate: this.quickDepositForm.depositDate,
      notes: this.quickDepositForm.notes.trim() || undefined,
    };

    this.api.post('/finance/deposits', payload).subscribe({
      next: () => {
        this.submittingDeposit.set(false);
        this.closeQuickDeposit();
        this.toast.set({
          message: 'Setoran berhasil dicatat & notifikasi WhatsApp terkirim ke pelanggan!',
          type: 'success',
        });
        this.loadAreaCustomers();
      },
      error: (err) => {
        this.submittingDeposit.set(false);
        this.toast.set({ message: err.message || 'Gagal mencatat setoran.', type: 'error' });
      },
    });
  }

  sendWaReminder(customer: AreaCustomer) {
    if (!customer.phone) {
      this.toast.set({ message: 'Pelanggan tidak memiliki nomor telepon terdaftar.', type: 'error' });
      return;
    }
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const amount = customer.activeInvoice?.amount || customer.unpaidAmount;
    const amountFormatted = this.formatCurrency(amount);

    const message = encodeURIComponent(
      `Halo Bapak/Ibu ${customer.customerName},\n\nKami dari PT UNZANET menginformasikan bahwa tagihan internet Anda sebesar *${amountFormatted}* telah terbit/jatuh tempo. Petugas kolektor kami akan melakukan penagihan di wilayah Anda.\n\nMohon siapkan pembayaran saat petugas kami berkunjung. Terima kasih! 🙏\n\n— PT UNZANET`
    );

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
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

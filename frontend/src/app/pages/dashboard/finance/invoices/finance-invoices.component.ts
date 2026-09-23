import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideSearch } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';

type InvoiceRow = {
  id: string;
  customerNumber: string;
  customerName: string;
  username: string;
  phone?: string | null;
  isActive: boolean;
  packageName: string;
  area?: { id: string; name: string } | null;
  collectors: { id: string; name: string }[];
  invoice?: { id: string; invoiceNumber: string; amount: number; dueDate: string; status: string; paidAt?: string | null } | null;
};

@Component({
  selector: 'app-finance-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideSearch],
  templateUrl: './finance-invoices.component.html',
})
export class FinanceInvoicesComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = signal(true);
  rows = signal<InvoiceRow[]>([]);
  search = '';
  status = '';
  error = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams();
    if (this.search.trim()) params.set('search', this.search.trim());
    if (this.status) params.set('status', this.status);
    this.api.get<{ data: InvoiceRow[] }>(`/finance/deposits/invoices?${params}`).subscribe({
      next: (response) => { this.rows.set(response.data); this.loading.set(false); },
      error: (err) => { this.error.set(err.message || 'Gagal memuat tagihan.'); this.loading.set(false); },
    });
  }

  statusLabel(row: InvoiceRow): string {
    if (!row.isActive) return 'Diisolir';
    if (!row.invoice) return 'Belum terbit';
    return ({ PAID: 'Lunas', PENDING: 'Belum bayar', OVERDUE: 'Lewat tempo' } as Record<string, string>)[row.invoice.status] ?? row.invoice.status;
  }

  statusClass(row: InvoiceRow): string {
    if (!row.isActive || row.invoice?.status === 'OVERDUE') return 'bg-red-100 text-red-700';
    if (row.invoice?.status === 'PAID') return 'bg-emerald-100 text-emerald-700';
    if (!row.invoice) return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-800';
  }

  date(value?: string | null): string {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(value));
  }

  currency(value?: number): string {
    return value === undefined ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }

  collectorNames(row: InvoiceRow): string {
    return row.collectors.map((collector) => collector.name).join(', ') || '-';
  }
}

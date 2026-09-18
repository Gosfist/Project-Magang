import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { FinanceSummary } from '../../../../shared/models/types';

@Component({
  selector: 'app-finance-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900">Ringkasan Keuangan</h1>
        <div class="flex gap-2">
          <select [(ngModel)]="selectedMonth" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            @for (m of months; track m.value) {
              <option [value]="m.value">{{ m.label }}</option>
            }
          </select>
          <select [(ngModel)]="selectedYear" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            @for (y of years; track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-12"><div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div></div>
      } @else if (summary()) {
        <!-- Monthly Cards -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Pemasukan Bulan Ini</p>
            <p class="mt-2 text-2xl font-bold text-emerald-600">{{ formatCurrency(summary()!.monthlyIncome) }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ summary()!.monthlyIncomeCount }} transaksi</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Pengeluaran Bulan Ini</p>
            <p class="mt-2 text-2xl font-bold text-red-600">{{ formatCurrency(summary()!.monthlyExpense) }}</p>
            <p class="mt-1 text-xs text-slate-400">{{ summary()!.monthlyExpenseCount }} transaksi</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Saldo Bulan Ini</p>
            <p class="mt-2 text-2xl font-bold" [class]="summary()!.monthlyBalance >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatCurrency(summary()!.monthlyBalance) }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Setoran Menunggu ACC</p>
            <p class="mt-2 text-2xl font-bold text-amber-600">{{ summary()!.pendingDeposits }}</p>
            <p class="mt-1 text-xs text-slate-400">setoran pending</p>
          </div>
        </div>

        <!-- Total Cards -->
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p class="text-sm font-medium text-emerald-700">Total Pemasukan Keseluruhan</p>
            <p class="mt-2 text-xl font-bold text-emerald-800">{{ formatCurrency(summary()!.totalIncome) }}</p>
          </div>
          <div class="rounded-xl border border-red-200 bg-red-50 p-5">
            <p class="text-sm font-medium text-red-700">Total Pengeluaran Keseluruhan</p>
            <p class="mt-2 text-xl font-bold text-red-800">{{ formatCurrency(summary()!.totalExpense) }}</p>
          </div>
          <div class="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p class="text-sm font-medium text-blue-700">Saldo Keseluruhan</p>
            <p class="mt-2 text-xl font-bold" [class]="summary()!.totalBalance >= 0 ? 'text-blue-800' : 'text-red-800'">{{ formatCurrency(summary()!.totalBalance) }}</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class FinanceSummaryComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true);
  summary = signal<FinanceSummary | null>(null);

  selectedMonth: number;
  selectedYear: number;

  months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
  ];
  years: number[] = [];

  constructor() {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) this.years.push(y);
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.get<FinanceSummary>(`/finance/summary?month=${this.selectedMonth}&year=${this.selectedYear}`).subscribe({
      next: (data) => { this.summary.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }
}

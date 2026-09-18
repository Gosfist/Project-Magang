import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideWallet,
  LucideClock,
  LucidePlus,
  LucideArrowUpRight,
  LucideArrowDownLeft,
  LucideFileText,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { FinanceSummary } from '../../../../shared/models/types';

@Component({
  selector: 'app-finance-summary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideWallet,
    LucideClock,
    LucidePlus,
    LucideArrowUpRight,
    LucideArrowDownLeft,
    LucideFileText,
  ],
  templateUrl: './finance-summary.component.html',
  styleUrl: './finance-summary.component.css',
})
export class FinanceSummaryComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true);
  summary = signal<FinanceSummary | null>(null);

  selectedMonth: number;
  selectedYear: number;

  months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];
  years: number[] = [];

  constructor() {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      this.years.push(y);
    }
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api
      .get<FinanceSummary>(`/finance/summary?month=${this.selectedMonth}&year=${this.selectedYear}`)
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { LucideGitBranch, LucideNetwork, LucideServer, LucideUsers } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AreaBillingSummary } from '../../../shared/models/types';

type StatCard = {
  label: string;
  value: number | undefined;
  currency?: boolean;
  type: 'server' | 'odc' | 'odp' | 'redaman' | 'users';
};

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink, LucideGitBranch, LucideNetwork, LucideServer, LucideUsers],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  private stats = signal<Record<string, number>>({});
  cards = signal<StatCard[]>([]);
  billingSummary = signal<AreaBillingSummary | null>(null);
  billingError = signal(false);

  selectedYear = 0;
  selectedMonth = 0;
  years: number[] = [];
  months: { value: number; label: string }[] = [];
  loading = signal(false);
  statsError = signal('');
  private requestId = 0;
  private monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  ngOnInit(): void {
    if (this.auth.isKolektor()) {
      this.api.get<{ summary: AreaBillingSummary }>('/areas/customers').subscribe({
        next: (data) => this.billingSummary.set(data.summary),
        error: () => this.billingError.set(true),
      });
    }
    this.loadStats();
  }

  loadStats(): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.statsError.set('');
    this.cards.set([]);
    const query = this.auth.isSales() && this.selectedYear && this.selectedMonth
      ? `?year=${this.selectedYear}&month=${this.selectedMonth}` : '';
    this.api.get<Record<string, number>>('/dashboard/stats' + query).subscribe({
      next: data => {
        if (id !== this.requestId) return;
        this.stats.set(data);
        if (this.auth.isSales()) {
          this.selectedYear = data['year'];
          this.selectedMonth = data['month'];
          this.years = Array.from({ length: data['currentYear'] - data['startYear'] + 1 }, (_, i) => data['startYear'] + i);
          this.updateMonths();
        }
        this.buildCards();
        this.loading.set(false);
      },
      error: err => {
        if (id !== this.requestId) return;
        this.loading.set(false);
        this.statsError.set(err.message || 'Gagal memuat dashboard.');
      },
    });
  }

  changeYear(): void {
    this.updateMonths();
    this.loadStats();
  }

  private updateMonths(): void {
    const data = this.stats();
    const first = this.selectedYear === data['startYear'] ? data['startMonth'] : 1;
    const last = this.selectedYear === data['currentYear'] ? data['currentMonth'] : 12;
    this.months = Array.from({ length: last - first + 1 }, (_, i) => ({ value: first + i, label: this.monthNames[first + i - 1] }));
    this.selectedMonth = Math.min(last, Math.max(first, this.selectedMonth));
  }

  formatSalary(value: number): string { return 'Rp ' + value.toLocaleString('id-ID'); }

  private buildCards(): void {
    const s = this.stats();
    let result: StatCard[] = [
      { label: 'Server Inti', value: s['totalServerCores'], type: 'server' },
      { label: 'Total ODC', value: s['totalOdcs'], type: 'odc' },
      { label: 'Total ODP', value: s['totalOdps'], type: 'odp' },
      { label: 'Data Redaman', value: s['totalWithRedaman'], type: 'redaman' },
    ];
    if (this.auth.isAdmin()) {
      result.push({ label: 'Total Teknisi', value: s['totalTeknisi'], type: 'users' });
      result.push({ label: 'Total Pengguna', value: s['totalUsers'], type: 'users' });
    } else if (this.auth.isSales()) {
      result = [
        { label: 'Inputan', value: s['monthlyRegistrations'], type: 'users' },
        { label: 'Selesai', value: s['monthlyCompletedOrders'], type: 'odp' },
        { label: 'Gaji', value: s['monthlySalary'], type: 'users', currency: true },
      ];
    } else if (this.auth.isTeknisi()) {
      result = [
        { label: 'Order Baru', value: s['newOrders'], type: 'users' },
        { label: 'Menunggu Selesai', value: s['activatedOrders'], type: 'redaman' },
        { label: 'Pemasangan Selesai', value: s['completedOrders'], type: 'odc' },
        { label: 'Pemasangan Selesai Bulan Ini', value: s['monthlyCompletedOrders'], type: 'odp' },
        { label: 'Gaji Bulan Ini', value: s['monthlySalary'], type: 'users', currency: true },
      ];
    } else if (this.auth.isKolektor()) {
      result = [
        { label: 'Pelanggan', value: s['assignedCustomers'], type: 'users' },
        { label: 'Menunggu Finance', value: s['pendingDeposits'], type: 'redaman' },
        { label: 'Pembayaran Selesai', value: s['acceptedDeposits'], type: 'odc' },
      ];
    } else if (this.auth.isFinance()) {
      result = [
        { label: 'Menunggu Diterima', value: s['pendingDeposits'], type: 'redaman' },
        { label: 'Pembayaran Selesai', value: s['acceptedDeposits'], type: 'odc' },
      ];
    }
    this.cards.set(result);
  }
}

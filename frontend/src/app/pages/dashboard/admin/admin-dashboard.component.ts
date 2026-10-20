import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideArrowUpRight, LucideBot, LucideHardHat, LucideMapPin, LucideNetwork,
  LucideRefreshCw, LucideRouter, LucideSettings, LucideTags, LucideUsers, LucideWallet,
} from '@lucide/angular';
import { catchError, filter, forkJoin, fromEvent, interval, merge, of, startWith, Subject, switchMap, tap, timeout } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { FinanceSummary } from '../../../shared/models/types';

type AdminStats = {
  totalCustomers: number; totalRouters: number; newOrders: number; activatedOrders: number;
  totalServerCores: number; totalOdcs: number; totalOdps: number; totalTeknisi: number; totalUsers: number;
  unpaidInvoices: number; unpaidInvoiceAmount: number;
};
type BotStatus = {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  botNumber?: string | null; uptime?: number;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, LucideArrowUpRight, LucideBot, LucideHardHat,
    LucideMapPin, LucideNetwork, LucideRefreshCw, LucideRouter, LucideSettings, LucideTags, LucideUsers, LucideWallet],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<void>();
  readonly stats = signal<AdminStats | null>(null);
  readonly finance = signal<FinanceSummary | null>(null);
  readonly bot = signal<BotStatus | null>(null);
  readonly loading = signal(true);
  readonly checkedAt = signal('');
  readonly period = signal('');
  readonly metrics: { label: string; key: keyof AdminStats; icon: string; path: string; description: string }[] = [
    { label: 'Total Pelanggan', key: 'totalCustomers', icon: 'users', path: '/dashboard/pppoe/data-pelanggan', description: 'Pelanggan terdaftar' },
    { label: 'Menunggu Pemasangan', key: 'newOrders', icon: 'hardhat', path: '/dashboard/pasang-baru', description: 'Registrasi dalam proses' },
    { label: 'Menunggu Penyelesaian', key: 'activatedOrders', icon: 'hardhat', path: '/dashboard/pasang-baru', description: 'Akun sudah diaktifkan' },
    { label: 'Router / NAS', key: 'totalRouters', icon: 'router', path: '/dashboard/router/routers', description: 'Perangkat terdaftar' },
  ];
  readonly shortcuts = [
    { label: 'Data Pelanggan', icon: 'users', path: '/dashboard/pppoe/data-pelanggan' },
    { label: 'Router / NAS', icon: 'router', path: '/dashboard/router/routers' },
    { label: 'Main Core', icon: 'network', path: '/dashboard/mainCore/traceJalur' },
    { label: 'Harga Paket', icon: 'tags', path: '/dashboard/pppoe/harga-paket' },
    { label: 'Pasang Baru', icon: 'hardhat', path: '/dashboard/pasang-baru' },
    { label: 'Finance', icon: 'wallet', path: '/dashboard/finance/dashboard' },
    { label: 'Data Area', icon: 'map', path: '/dashboard/area' },
    { label: 'Bot WhatsApp', icon: 'bot', path: '/dashboard/bot-whatsapp/status' },
    { label: 'Akun & Role', icon: 'users', path: '/dashboard/users' },
    { label: 'Pengaturan', icon: 'settings', path: '/dashboard/pengaturan' },
  ];

  ngOnInit(): void {
    merge(interval(60000), this.refreshRequests, fromEvent(this.document, 'visibilitychange'))
      .pipe(
        startWith(null),
        filter(() => !this.document.hidden),
        tap(() => this.loading.set(true)),
        switchMap(() => {
          const now = new Date();
          const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', month: 'numeric', year: 'numeric' }).formatToParts(now);
          const month = parts.find(part => part.type === 'month')!.value;
          const year = parts.find(part => part.type === 'year')!.value;
          this.period.set(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }).format(now));
          return forkJoin({
            stats: this.api.get<AdminStats>('/dashboard/stats').pipe(timeout(15000), catchError(() => of(null))),
            finance: this.api.get<FinanceSummary>(`/finance/summary?month=${month}&year=${year}`).pipe(timeout(15000), catchError(() => of(null))),
            bot: this.http.get<BotStatus>(`${environment.botWaUrl}/status`).pipe(timeout(10000), catchError(() => of(null))),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(result => {
        this.stats.set(result.stats);
        this.finance.set(result.finance);
        this.bot.set(result.bot);
        this.loading.set(false);
        this.checkedAt.set(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' WIB');
      });
  }

  refresh(): void { this.refreshRequests.next(); }
  currency(value: number | null | undefined): string { return typeof value === 'number' ? 'Rp ' + value.toLocaleString('id-ID') : '—'; }
  count(value: number | null | undefined): string { return typeof value === 'number' ? value.toLocaleString('id-ID') : '—'; }
  get botLabel(): string {
    const status = this.bot()?.status;
    if (!status) return this.loading() ? 'Memeriksa koneksi...' : 'Tidak dapat dihubungi';
    return { connected: 'Terhubung', disconnected: 'Terputus', connecting: 'Menghubungkan', qr_ready: 'Menunggu Scan QR' }[status] ?? 'Tidak diketahui';
  }
  get botDescription(): string {
    switch (this.bot()?.status) {
      case 'connected': return 'Koneksi WhatsApp siap digunakan.';
      case 'qr_ready': return 'Buka halaman Bot WhatsApp untuk memindai QR.';
      case 'connecting': return 'Bot sedang menghubungkan sesi WhatsApp.';
      case 'disconnected': return 'Hubungkan kembali bot melalui halaman Bot WhatsApp.';
      default: return this.loading() ? 'Mengambil status Bot WhatsApp.' : 'Status bot belum tersedia. Coba perbarui atau buka halaman Bot WhatsApp.';
    }
  }
  get botUptime(): string {
    const seconds = this.bot()?.uptime;
    if (seconds === undefined || this.bot()?.status !== 'connected') return '—';
    if (seconds < 60) return 'Kurang dari 1 menit';
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
  }
}

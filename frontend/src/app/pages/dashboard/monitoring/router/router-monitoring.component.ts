import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { StatsChartComponent, ChartStatItem } from '../../../../shared/components/stats-chart/stats-chart.component';
import { LucideRefreshCw, LucideRouter, LucideServer } from '@lucide/angular';

interface RouterOption {
  id: number;
  name: string;
  host: string;
  description?: string;
}

interface RouterRealtimeData {
  router: { id: number; name: string; host: string };
  uptime: number;
  cpu: { percent: number; cores: number; model: string };
  memory: { total: number; free: number; used: number; percent: number };
  network: { download: number; upload: number };
  board: { name: string; version: string; architecture: string };
  checkedAt: string;
}

interface MikrotikLogItem {
  id: string;
  time: string;
  topics: string;
  message: string;
}

@Component({
  selector: 'app-router-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, StatsChartComponent, LucideRefreshCw, LucideRouter],
  templateUrl: './router-monitoring.component.html',
  styleUrl: './router-monitoring.component.css',
})
export class RouterMonitoringComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  routerOptions = signal<RouterOption[]>([]);
  selectedRouterId = signal<number | null>(null);

  realtime = signal<RouterRealtimeData | null>(null);
  realtimeLoading = signal(false);
  realtimeError = signal('');

  // Charts
  cpuPeriod: 'daily' | 'monthly' | 'yearly' = 'daily';
  cpuItems = signal<ChartStatItem[]>([]);
  cpuLoading = signal(false);

  ramPeriod: 'daily' | 'monthly' | 'yearly' = 'daily';
  ramItems = signal<ChartStatItem[]>([]);
  ramLoading = signal(false);

  netPeriod: 'daily' | 'monthly' | 'yearly' = 'daily';
  netItems = signal<ChartStatItem[]>([]);
  netLoading = signal(false);

  // Logs
  logs = signal<MikrotikLogItem[]>([]);
  logsLoading = signal(false);
  logsError = signal('');

  private pollInterval: any = null;

  ngOnInit(): void {
    this.loadRouterOptions();

    this.destroyRef.onDestroy(() => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    });
  }

  loadRouterOptions(): void {
    this.api.get<{ id: number; name: string; host: string }[]>('/monitoring/router/options').subscribe({
      next: (options) => {
        this.routerOptions.set(options);
        if (options.length > 0 && !this.selectedRouterId()) {
          this.selectRouter(options[0].id);
        }
      },
      error: () => {
        this.realtimeError.set('Gagal memuat daftar Router/NAS.');
      },
    });
  }

  selectRouter(id: number): void {
    this.selectedRouterId.set(id);
    this.loadRealtime();
    this.loadCpuStats();
    this.loadRamStats();
    this.loadNetStats();
    this.loadLogs();

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    // Refresh data realtime setiap 10 detik
    this.pollInterval = setInterval(() => {
      this.loadRealtime(true);
    }, 10000);
  }

  loadRealtime(silent = false): void {
    const id = this.selectedRouterId();
    if (!id) return;

    if (!silent) this.realtimeLoading.set(true);
    this.realtimeError.set('');

    this.api.get<RouterRealtimeData>(`/monitoring/router/${id}/realtime`).subscribe({
      next: (data) => {
        this.realtime.set(data);
        this.realtimeLoading.set(false);
      },
      error: (err) => {
        this.realtimeError.set(err.message || 'Gagal menghubungi MikroTik.');
        this.realtimeLoading.set(false);
      },
    });
  }

  loadCpuStats(): void {
    const id = this.selectedRouterId();
    if (!id) return;
    this.cpuLoading.set(true);

    this.api.get<{ period: string; data: ChartStatItem[] }>(`/monitoring/router/${id}/stats?period=${this.cpuPeriod}`).subscribe({
      next: (res) => {
        this.cpuItems.set(res.data);
        this.cpuLoading.set(false);
      },
      error: () => this.cpuLoading.set(false),
    });
  }

  onCpuPeriodChange(period: 'daily' | 'monthly' | 'yearly'): void {
    this.cpuPeriod = period;
    this.loadCpuStats();
  }

  loadRamStats(): void {
    const id = this.selectedRouterId();
    if (!id) return;
    this.ramLoading.set(true);

    this.api.get<{ period: string; data: ChartStatItem[] }>(`/monitoring/router/${id}/stats?period=${this.ramPeriod}`).subscribe({
      next: (res) => {
        this.ramItems.set(res.data);
        this.ramLoading.set(false);
      },
      error: () => this.ramLoading.set(false),
    });
  }

  onRamPeriodChange(period: 'daily' | 'monthly' | 'yearly'): void {
    this.ramPeriod = period;
    this.loadRamStats();
  }

  loadNetStats(): void {
    const id = this.selectedRouterId();
    if (!id) return;
    this.netLoading.set(true);

    this.api.get<{ period: string; data: ChartStatItem[] }>(`/monitoring/router/${id}/stats?period=${this.netPeriod}`).subscribe({
      next: (res) => {
        this.netItems.set(res.data);
        this.netLoading.set(false);
      },
      error: () => this.netLoading.set(false),
    });
  }

  onNetPeriodChange(period: 'daily' | 'monthly' | 'yearly'): void {
    this.netPeriod = period;
    this.loadNetStats();
  }

  loadLogs(): void {
    const id = this.selectedRouterId();
    if (!id) return;
    this.logsLoading.set(true);
    this.logsError.set('');

    this.api.get<MikrotikLogItem[]>(`/monitoring/router/${id}/logs`).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.logsLoading.set(false);
      },
      error: (err) => {
        this.logsError.set(err.message || 'Gagal membaca log MikroTik.');
        this.logsLoading.set(false);
      },
    });
  }

  duration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    const s = Math.floor(seconds % 60);
    return `${d} hari ${h} jam ${m} menit ${s} detik`;
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  }
}

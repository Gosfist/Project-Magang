import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { StatsChartComponent, ChartStatItem } from '../../../../shared/components/stats-chart/stats-chart.component';

type ServerSnapshot = {
  checkedAt: string;
  hostname: string;
  platform: string;
  cpu: { percent: number; cores: number; model: string };
  memory: { total: number; used: number; percent: number };
  disk: { total: number; used: number } | null;
  traffic: { interface: string | null; checkedAt: string | null; download: number | null; upload: number | null };
  network: { name: string; address: string }[];
  hostUptime: number;
  appUptime: number;
  logs: { time: string; method: string; route: string; status: number }[];
};

@Component({
  selector: 'app-server-monitoring',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, StatsChartComponent],
  templateUrl: './server.component.html',
  styleUrl: './server.component.css',
})
export class ServerMonitoringComponent implements OnInit {
  readonly data = signal<ServerSnapshot | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  private controller: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  activities = signal<{ id: string; createdAt: string; userName: string; role: string; module: string; action: string; description: string; status: string }[]>([]);
  total = signal(0);
  page = 1;
  lastPage = 1;
  search = '';
  module = '';
  activityError = signal('');
  private activityController: AbortController | null = null;
  private lastActivityFetch = 0;

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

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.activityController?.abort();
      this.controller?.abort();
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    });
  }

  ngOnInit(): void {
    void this.connect();
    void this.loadCpuStats();
    void this.loadRamStats();
    void this.loadNetStats();
  }

  async loadCpuStats() {
    this.cpuLoading.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/monitoring/server/stats?period=${this.cpuPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('unzanet_token') ?? ''}` },
      });
      if (res.ok) {
        const json = await res.json();
        this.cpuItems.set(json.data || []);
      }
    } catch {
      // Ignore
    } finally {
      this.cpuLoading.set(false);
    }
  }

  onCpuPeriodChange(period: 'daily' | 'monthly' | 'yearly') {
    this.cpuPeriod = period;
    void this.loadCpuStats();
  }

  async loadRamStats() {
    this.ramLoading.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/monitoring/server/stats?period=${this.ramPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('unzanet_token') ?? ''}` },
      });
      if (res.ok) {
        const json = await res.json();
        this.ramItems.set(json.data || []);
      }
    } catch {
      // Ignore
    } finally {
      this.ramLoading.set(false);
    }
  }

  onRamPeriodChange(period: 'daily' | 'monthly' | 'yearly') {
    this.ramPeriod = period;
    void this.loadRamStats();
  }

  async loadNetStats() {
    this.netLoading.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/monitoring/server/stats?period=${this.netPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('unzanet_token') ?? ''}` },
      });
      if (res.ok) {
        const json = await res.json();
        this.netItems.set(json.data || []);
      }
    } catch {
      // Ignore
    } finally {
      this.netLoading.set(false);
    }
  }

  onNetPeriodChange(period: 'daily' | 'monthly' | 'yearly') {
    this.netPeriod = period;
    void this.loadNetStats();
  }

  async loadActivities(reset = false) {
    if (reset) this.page = 1;
    this.activityController?.abort();
    const controller = new AbortController();
    this.activityController = controller;
    this.lastActivityFetch = Date.now();
    try {
      const query = new URLSearchParams({ search: this.search, module: this.module, page: String(this.page) });
      const response = await fetch(`${environment.apiUrl}/monitoring/activities?${query}`, { headers: { Authorization: `Bearer ${localStorage.getItem('unzanet_token') ?? ''}` }, signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      this.activities.set(result.data); this.total.set(result.total); this.lastPage = result.lastPage;
      if (this.page > this.lastPage) { this.page = this.lastPage; void this.loadActivities(); return; }
      this.activityError.set('');
    } catch { if (!controller.signal.aborted) this.activityError.set('Log aktivitas gagal dimuat.'); }
  }

  pageNumbers(): number[] {
    const count = Math.min(5, this.lastPage);
    const start = Math.max(1, Math.min(this.page - 2, this.lastPage - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  }

  goToPage(page: number) {
    const next = Math.max(1, Math.min(this.lastPage, page));
    if (next === this.page) return;
    this.page = next;
    void this.loadActivities();
  }

  private async connect() {
    const controller = new AbortController();
    this.controller = controller;
    this.loading.set(true);
    try {
      const response = await fetch(`${environment.apiUrl}/monitoring/server/stream`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('unzanet_token') ?? ''}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (response.status === 401) {
        this.error.set('Sesi berakhir. Silakan login kembali.');
        this.loading.set(false);
        return;
      }
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Stream closed');
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const payload = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
          if (!payload) continue;
          const data = JSON.parse(payload);
          this.loading.set(false);
          if (data.error) this.error.set(data.error);
          else { this.data.set(data); this.error.set(''); if (Date.now() - this.lastActivityFetch >= 5000) void this.loadActivities(); }
        }
      }
    } catch {
      if (controller.signal.aborted || this.destroyed) return;
      this.loading.set(false);
      this.error.set('Koneksi monitoring terputus. Menghubungkan kembali; data terakhir mungkin sudah tidak terbaru.');
      this.reconnectTimer = setTimeout(() => void this.connect(), 2000);
    }
  }

  refresh() {
    this.controller?.abort();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    void this.connect();
  }

  gib(bytes: number) { return bytes / 1024 ** 3; }
  duration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    return `${Math.floor(minutes / 1440)}\u00a0hari ${Math.floor(minutes % 1440 / 60)}\u00a0jam ${minutes % 60}\u00a0menit ${Math.floor(seconds % 60)}\u00a0detik`;
  }
}

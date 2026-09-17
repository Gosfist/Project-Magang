import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';

interface RadiusLogItem {
  id: string;
  username: string;
  pass: string;
  reply: string;
  authdate: string;
  class: string;
}

interface RadiusLogResponse {
  data: RadiusLogItem[];
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
  summary: { total: number; success: number; failed: number };
}

@Component({
  selector: 'app-radius-monitoring',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './radius-monitoring.component.html',
})
export class RadiusMonitoringComponent implements OnInit {
  private readonly api = inject(ApiService);

  logs = signal<RadiusLogItem[]>([]);
  summary = signal({ total: 0, success: 0, failed: 0 });
  meta = signal({ currentPage: 1, lastPage: 1, perPage: 25, total: 0 });
  loading = signal(false);
  error = signal('');
  page = 1;

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page): void {
    this.page = page;
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({
      search: '',
      reply: '',
      page: String(this.page),
    });
    this.api.get<RadiusLogResponse>(`/monitoring/radius/logs?${params.toString()}`).subscribe({
      next: (res) => {
        this.logs.set(res.data || []);
        this.summary.set(res.summary || { total: 0, success: 0, failed: 0 });
        this.meta.set(res.meta || { currentPage: 1, lastPage: 1, perPage: 25, total: 0 });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Gagal memuat log FreeRADIUS.');
        this.loading.set(false);
      },
    });
  }

  pageTo(direction: -1 | 1): void {
    const next = this.page + direction;
    if (next < 1 || next > this.meta().lastPage) return;
    this.load(next);
  }

  isSuccess(reply: string): boolean {
    return /accept/i.test(reply);
  }

  statusLabel(reply: string): string {
    if (/accept/i.test(reply)) return 'Berhasil';
    if (/reject/i.test(reply)) return 'Gagal';
    return reply || '-';
  }
}

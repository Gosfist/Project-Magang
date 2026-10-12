import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type Config = { enabled: boolean; poolName: string; subnet: string; localAddress: string };
type Job = { status: string; processed: number; reconnected: number; message: string };
@Component({ selector: 'app-pppoe-isolation', standalone: true, imports: [FormsModule, RouterLink, ToastComponent], templateUrl: './isolation.component.html' })
export class IsolationComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly latest = latestRequest();
  private readonly latestStatus = latestRequest();
  private timer?: ReturnType<typeof setInterval>;
  routers = signal<{ id: number; displayName: string }[]>([]);
  pools = signal<{ name: string; ranges: string }[]>([]);
  rules = signal<Record<string, string>[]>([]);
  routerId = 0; loading = signal(false); saving = signal(false); ready = signal(false); error = signal(''); job = signal<Job | null>(null);
  form: Config = { enabled: false, poolName: '', subnet: '192.168.100.0/24', localAddress: '192.168.100.1' };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  ngOnInit() {
    this.api.get<{ data: { id: number; displayName: string }[] }>('/router/nas/options').subscribe({ next: result => {
      this.routers.set(result.data); if (result.data[0]) { this.routerId = result.data[0].id; this.load(); }
    }, error: err => this.error.set(err.message) });
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }
  load() {
    if (this.timer) clearInterval(this.timer);
    this.loading.set(true); this.error.set(''); this.ready.set(false); this.job.set(null);
    this.api.get<{ config: Config; ready: boolean; pools: { name: string; ranges: string }[]; rules: Record<string, string>[]; job: Job | null }>(`/pppoe/isolation/${this.routerId}`).pipe(this.latest).subscribe({
      next: result => {
        this.form = { enabled: result.config.enabled, poolName: result.config.poolName || '', subnet: result.config.subnet || '192.168.100.0/24', localAddress: result.config.localAddress || '192.168.100.1' };
        this.pools.set(result.pools); this.rules.set(result.rules); this.ready.set(result.ready); this.job.set(result.job); this.loading.set(false);
        if (result.job?.status === 'running') this.poll();
      }, error: err => { this.error.set(err.message); this.loading.set(false); },
    });
  }
  save() {
    if (this.saving() || this.job()?.status === 'running') return;
    this.saving.set(true);
    this.api.post<{ message: string; job: Job }>(`/pppoe/isolation/${this.routerId}`, this.form).subscribe({ next: result => {
      this.saving.set(false); this.toast.set({ message: result.message, type: 'success' }); this.job.set(result.job); this.poll();
    }, error: err => { this.saving.set(false); this.toast.set({ message: err.message, type: 'error' }); } });
  }
  sync() {
    if (this.saving() || this.job()?.status === 'running') return;
    this.saving.set(true);
    this.api.post<{ job: Job }>(`/pppoe/isolation/${this.routerId}/sync`, {}).subscribe({ next: result => { this.saving.set(false); this.job.set(result.job); this.poll(); }, error: err => { this.saving.set(false); this.toast.set({ message: err.message, type: 'error' }); } });
  }
  private poll() {
    if (this.timer) clearInterval(this.timer);
    const routerId = this.routerId;
    this.timer = setInterval(() => this.api.get<{ job: Job | null }>(`/pppoe/isolation/${routerId}/status`).pipe(this.latestStatus).subscribe({
      next: result => { if (this.routerId !== routerId) return; this.job.set(result.job); if (result.job?.status !== 'running') this.load(); },
      error: err => { if (this.routerId === routerId) this.error.set(err.message); },
    }), 2000);
  }
}

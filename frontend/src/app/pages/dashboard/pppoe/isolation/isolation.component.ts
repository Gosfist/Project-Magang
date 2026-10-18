import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type Config = { enabled: boolean; poolName: string; subnet: string; localAddress: string };
type Job = { status: string; processed: number; reconnected: number; message: string };
type SaveResult = { message: string; script?: string; scriptFingerprint?: string; requiresConfirmation?: boolean; config?: Config; job?: Job };
@Component({ selector: 'app-pppoe-isolation', standalone: true, imports: [FormsModule, RouterLink, ModalComponent, ToastComponent], templateUrl: './isolation.component.html' })
export class IsolationComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly latest = latestRequest();
  private readonly latestStatus = latestRequest();
  private timer?: ReturnType<typeof setInterval>;
  private pendingConfig: Config | null = null;
  private pendingScriptFingerprint: string | null = null;
  routers = signal<{ id: number; displayName: string }[]>([]);
  pools = signal<{ name: string; ranges: string }[]>([]);
  routerId = 0; loading = signal(false); saving = signal(false); error = signal(''); job = signal<Job | null>(null);
  script = signal(''); scriptOpen = signal(false); needsConfirmation = signal(false); scriptInstalled = false;
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
    this.closeScript(); this.script.set('');
    if (!this.routerId) return;
    this.loading.set(true); this.error.set(''); this.job.set(null);
    this.api.get<{ config: Config; pools: { name: string; ranges: string }[]; script?: string; job: Job | null }>(`/pppoe/isolation/${this.routerId}`).pipe(this.latest).subscribe({
      next: result => {
        this.form = { enabled: result.config.enabled, poolName: result.config.poolName || '', subnet: result.config.subnet || '192.168.100.0/24', localAddress: result.config.localAddress || '192.168.100.1' };
        this.pools.set(result.pools); this.script.set(result.script || ''); this.job.set(result.job); this.loading.set(false);
        if (result.job?.status === 'running') this.poll();
      }, error: err => { this.error.set(err.message); this.loading.set(false); },
    });
  }
  save() {
    if (this.saving() || this.job()?.status === 'running') return;
    this.submit({ ...this.form });
  }
  activate() {
    if (!this.scriptInstalled || !this.pendingConfig || !this.pendingScriptFingerprint || this.saving()) return;
    this.submit({ ...this.pendingConfig, scriptInstalled: true, scriptFingerprint: this.pendingScriptFingerprint });
  }
  private submit(config: Config & { scriptInstalled?: boolean; scriptFingerprint?: string }) {
    const routerId = this.routerId;
    this.saving.set(true);
    this.api.post<SaveResult>(`/pppoe/isolation/${routerId}`, config).subscribe({ next: result => {
      this.saving.set(false);
      if (routerId !== this.routerId) return;
      this.toast.set({ message: result.message, type: 'success' });
      if (result.script) this.script.set(result.script);
      if (result.requiresConfirmation) {
        this.pendingConfig = { enabled: config.enabled, poolName: config.poolName, subnet: config.subnet, localAddress: config.localAddress };
        this.pendingScriptFingerprint = result.scriptFingerprint || null;
        this.needsConfirmation.set(true); this.scriptInstalled = false; this.scriptOpen.set(true);
        return;
      }
      this.closeScript();
      if (result.config) this.form = { ...result.config };
      this.job.set(result.job || null);
      if (result.job?.status === 'running') this.poll();
      else this.load();
    }, error: err => {
      this.saving.set(false);
      if (config.scriptInstalled) this.closeScript();
      this.toast.set({ message: err.message, type: 'error' });
    } });
  }
  closeScript() {
    this.scriptOpen.set(false); this.needsConfirmation.set(false); this.scriptInstalled = false; this.pendingConfig = null; this.pendingScriptFingerprint = null;
  }
  sync() {
    if (this.saving() || this.job()?.status === 'running') return;
    this.saving.set(true);
    this.api.post<{ job: Job }>(`/pppoe/isolation/${this.routerId}/sync`, {}).subscribe({ next: result => {
      this.saving.set(false); this.job.set(result.job); if (result.job?.status === 'running') this.poll(); else this.load();
    }, error: err => { this.saving.set(false); this.toast.set({ message: err.message, type: 'error' }); } });
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

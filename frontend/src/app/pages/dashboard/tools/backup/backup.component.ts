import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type Settings = { localAddress: string; baseProfile: string };
type RouterOption = { id: number; name: string; count: number; isActive: boolean; settings: Settings; networkManaged?: boolean };
type Preview = { total: number; create: number; update: number; token: string | null; errors: { row: number; message: string }[]; rows: { row: number; customerNumber: string; customerName: string; username: string; packageName: string; routerName: string; action: string }[] };

@Component({ selector: 'app-backup', standalone: true, imports: [FormsModule, ToastComponent], templateUrl: './backup.component.html' })
export class BackupComponent implements OnInit {
  private readonly api = inject(ApiService);
  routers = signal<RouterOption[]>([]); unassigned = signal(0); loading = signal(false); busy = signal(false); error = signal('');
  routerId = 0; settings: Settings = { localAddress: '', baseProfile: 'default' }; reconnect = false;
  mode = 'create'; file: File | null = null; preview = signal<Preview | null>(null);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.get<{ routers: RouterOption[]; unassigned: number }>('/settings/backup/options').subscribe({ next: result => {
      this.routers.set(result.routers); this.unassigned.set(result.unassigned);
      if (!result.routers.some(router => router.id === this.routerId)) this.routerId = result.routers[0]?.id || 0;
      this.selectRouter(); this.loading.set(false);
    }, error: err => { this.loading.set(false); this.error.set(err.message); } });
  }
  selectRouter() { this.settings = { ...(this.routers().find(router => router.id === this.routerId)?.settings || { localAddress: '', baseProfile: 'default' }) }; }
  selectedCount() { return this.routers().find(router => router.id === this.routerId)?.count || 0; }
  networkManaged() { return this.routers().find(router => router.id === this.routerId)?.networkManaged === true; }
  settingsSaved() { const saved = this.routers().find(router => router.id === this.routerId)?.settings; return !!saved?.localAddress && saved.localAddress === this.settings.localAddress && saved.baseProfile === this.settings.baseProfile.trim(); }
  saveSettings() {
    if (this.busy() || !this.routerId) return;
    this.busy.set(true);
    this.api.patch<{ message: string; settings: Settings }>(`/settings/backup/router/${this.routerId}`, this.settings).subscribe({ next: result => {
      this.routers.update(routers => routers.map(router => router.id === this.routerId ? { ...router, settings: result.settings } : router));
      this.busy.set(false); this.toast.set({ message: result.message, type: 'success' });
    }, error: err => this.failure(err) });
  }
  downloadScript(mode: 'local' | 'radius') {
    if (!this.routerId || this.busy()) return;
    if (mode === 'local' && !this.settingsSaved()) { this.toast.set({ message: 'Simpan pengaturan backup sebelum mengunduh script lokal.', type: 'error' }); return; }
    this.download(this.api.postBlob(`/settings/backup/router/${this.routerId}/script`, { mode, reconnect: this.reconnect }), `pppoe-${mode}-router-${this.routerId}.rsc`);
  }
  downloadExcel(all = false) {
    if (this.busy()) return;
    const path = '/settings/backup/excel' + (!all && this.routerId ? `?routerId=${this.routerId}` : '');
    this.download(this.api.getBlob(path), `backup-akun-pppoe-${all ? 'semua' : this.routerId}.xlsx`);
  }
  downloadTemplate() { if (!this.busy()) this.download(this.api.getBlob('/settings/backup/template'), 'template-akun-pppoe.xlsx'); }
  private download(request: Observable<Blob>, filename: string) {
    this.busy.set(true);
    request.subscribe({ next: blob => {
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.busy.set(false); this.toast.set({ message: 'File diunduh. Simpan sebagai cadangan sebelum terjadi gangguan.', type: 'success' });
    }, error: err => this.failure(err) });
  }
  chooseFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null; this.preview.set(null);
    if (this.file && (!this.file.name.toLowerCase().endsWith('.xlsx') || this.file.size > 5 * 1024 * 1024)) { this.file = null; this.toast.set({ message: 'Gunakan file .xlsx maksimal 5 MB.', type: 'error' }); }
  }
  private formData(token?: string) { const body = new FormData(); body.append('file', this.file!); body.append('mode', this.mode); if (token) body.append('token', token); return body; }
  checkFile() {
    if (!this.file || this.busy()) return;
    this.busy.set(true); this.preview.set(null);
    this.api.post<Preview>('/settings/backup/preview', this.formData()).subscribe({ next: result => { this.preview.set(result); this.busy.set(false); }, error: err => this.failure(err) });
  }
  importFile() {
    const preview = this.preview(); if (!this.file || this.busy() || !preview?.token || preview.errors.length) return;
    this.busy.set(true);
    this.api.post<{ message: string }>('/settings/backup/import', this.formData(preview.token)).subscribe({ next: result => {
      this.busy.set(false); this.preview.set(null); this.toast.set({ message: result.message, type: 'success' }); this.load();
    }, error: err => { this.preview.set(null); this.failure(err); } });
  }
  private failure(err: Error) { this.busy.set(false); this.toast.set({ message: err.message, type: 'error' }); }
}

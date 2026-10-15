import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCopy, LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch, LucideTerminal, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { PageMeta, VpnClient, VpnCapacity, ZeroTierScriptData } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-vpn-client', standalone: true,
  imports: [FormsModule, LucideCopy, LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch, LucideTerminal, LucideTrash2,
    ModalComponent, PaginationComponent, ToastComponent],
  templateUrl: './vpn-client.component.html',
})
export class VpnClientComponent implements OnInit {
  private readonly latestLoad = latestRequest();
  private readonly api = inject(ApiService);
  readonly items = signal<VpnClient[]>([]);
  readonly capacity = signal<VpnCapacity | null>(null);
  readonly meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  readonly page = signal(1);
  search = '';
  readonly open = signal(false);
  readonly editing = signal<VpnClient | null>(null);
  readonly saving = signal(false);
  readonly checking = signal<string | null>(null);
  readonly scriptModalOpen = signal(false);
  readonly scriptData = signal<ZeroTierScriptData | null>(null);
  readonly copied = signal(false);
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  form = this.emptyForm();

  private emptyForm() {
    return { name: '', networkId: '', nodeId: '', vpnIp: '', deviceType: 'mikrotik', description: '', isRadiusServer: false, isActive: true };
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.get<{ data: VpnClient[]; meta: PageMeta; capacity: VpnCapacity }>(
      `/router/vpn-client?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
    ).pipe(this.latestLoad).subscribe({
      next: response => { this.items.set(response.data); this.meta.set(response.meta); this.capacity.set(response.capacity); },
      error: error => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  show(item?: VpnClient): void {
    this.editing.set(item ?? null);
    this.form = item ? { name: item.name, networkId: item.networkId || this.capacity()?.networkId || '',
      nodeId: item.nodeId || '', vpnIp: item.vpnIp, deviceType: item.deviceType,
      description: item.description || '', isRadiusServer: item.isRadiusServer, isActive: item.isActive }
      : { ...this.emptyForm(), networkId: this.capacity()?.networkId || '' };
    this.open.set(true);
  }

  radiusChanged(): void { if (this.form.isRadiusServer) this.form.deviceType = 'linux'; }

  save(): void {
    if (this.saving()) return;
    const body = { ...this.form, networkId: this.form.networkId.trim().toLowerCase(), nodeId: this.form.nodeId.trim().toLowerCase() };
    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/router/vpn-client/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/router/vpn-client', body);
    this.saving.set(true);
    req.subscribe({
      next: response => { this.saving.set(false); this.open.set(false); this.toast.set({ message: response.message, type: 'success' }); this.load(); },
      error: error => { this.saving.set(false); this.toast.set({ message: error.message, type: 'error' }); },
    });
  }

  remove(item: VpnClient): void {
    if (!confirm(`Hapus pencatatan ${item.name}? Untuk melepaskan slot ZeroTier, lakukan leave pada perangkat dan deauthorize di Central juga.`)) return;
    this.api.delete<{ message: string }>(`/router/vpn-client/${item.id}`).subscribe({
      next: response => { this.toast.set({ message: response.message, type: 'success' }); this.load(); },
      error: error => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  openScript(item: VpnClient): void {
    this.api.get<ZeroTierScriptData>(`/router/vpn-client/${item.id}/script`).subscribe({
      next: response => { this.scriptData.set(response); this.copied.set(false); this.scriptModalOpen.set(true); },
      error: error => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  check(item: VpnClient): void {
    if (this.checking()) return;
    this.checking.set(item.id);
    this.api.post<{ success: boolean; message: string }>(`/router/vpn-client/${item.id}/check`, {}).subscribe({
      next: response => { this.checking.set(null); this.toast.set({ message: response.message, type: response.success ? 'success' : 'error' }); },
      error: error => { this.checking.set(null); this.toast.set({ message: error.message, type: 'error' }); },
    });
  }

  async copyScript(): Promise<void> {
    const data = this.scriptData();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.script);
      this.copied.set(true);
    } catch { this.toast.set({ message: 'Salin otomatis tidak tersedia. Pilih teks script lalu salin manual, atau buka web melalui HTTPS.', type: 'error' }); }
  }
}

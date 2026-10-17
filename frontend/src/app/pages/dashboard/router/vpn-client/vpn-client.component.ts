import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { PageMeta, VpnClient } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-vpn-client', standalone: true,
  imports: [FormsModule, LucidePencil, LucidePlus, LucideRefreshCw, LucideSearch, LucideTrash2,
    ModalComponent, PaginationComponent, ToastComponent],
  templateUrl: './vpn-client.component.html',
})
export class VpnClientComponent implements OnInit {
  private readonly latestLoad = latestRequest();
  private readonly api = inject(ApiService);
  readonly items = signal<VpnClient[]>([]);
  readonly legacyCount = signal(0);
  readonly meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  readonly page = signal(1);
  search = '';
  readonly open = signal(false);
  readonly editing = signal<VpnClient | null>(null);
  readonly saving = signal(false);
  readonly checking = signal<string | null>(null);
  readonly toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  form: { deviceType: 'radius' | 'mikrotik'; vpnIp: string; isActive: boolean } = { deviceType: 'mikrotik', vpnIp: '', isActive: true };

  ngOnInit(): void { this.load(); }
  load(): void {
    this.api.get<{ data: VpnClient[]; meta: PageMeta; legacyCount: number }>(
      `/router/vpn-client?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
    ).pipe(this.latestLoad).subscribe({
      next: response => { this.items.set(response.data); this.meta.set(response.meta); this.legacyCount.set(response.legacyCount); },
      error: error => this.error(error),
    });
  }
  show(item?: VpnClient): void {
    this.editing.set(item ?? null);
    this.form = item ? { deviceType: item.deviceType, vpnIp: item.vpnIp, isActive: item.isActive }
      : { deviceType: 'mikrotik', vpnIp: '', isActive: true };
    this.open.set(true);
  }
  save(): void {
    if (this.saving()) return;
    const body = { ...this.form, vpnIp: this.form.vpnIp.trim() };
    const req = this.editing() ? this.api.patch<{ message: string }>(`/router/vpn-client/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/router/vpn-client', body);
    this.saving.set(true);
    req.subscribe({
      next: response => { this.saving.set(false); this.open.set(false); this.success(response.message); this.load(); },
      error: error => { this.saving.set(false); this.error(error); },
    });
  }
  remove(item: VpnClient): void {
    if (!confirm(`Hapus catatan IP VPN ${item.vpnIp}? Peer WireGuard di VPS / penyedia VPN tetap ada.`)) return;
    this.api.delete<{ message: string }>(`/router/vpn-client/${item.id}`).subscribe({
      next: response => { this.success(response.message); this.load(); }, error: error => this.error(error),
    });
  }
  check(item: VpnClient): void {
    if (this.checking()) return;
    this.checking.set(item.id);
    this.api.post<{ success: boolean; message: string }>(`/router/vpn-client/${item.id}/check`, {}).subscribe({
      next: response => { this.checking.set(null); this.toast.set({ message: response.message, type: response.success ? 'success' : 'error' }); },
      error: error => { this.checking.set(null); this.error(error); },
    });
  }
  private success(message: string) { this.toast.set({ message, type: 'success' }); }
  private error(error: Error) { this.toast.set({ message: error.message, type: 'error' }); }
}

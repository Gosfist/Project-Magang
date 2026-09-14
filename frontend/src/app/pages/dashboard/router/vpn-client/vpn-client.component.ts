import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideCopy,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideTerminal,
  LucideTrash2,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PageMeta, VpnClient, VpnServer, WireguardScriptData } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-vpn-client',
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucideCopy,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideTerminal,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './vpn-client.component.html',
})
export class VpnClientComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<VpnClient[]>([]);
  servers = signal<VpnServer[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = '';
  page = signal(1);

  open = signal(false);
  editing = signal<VpnClient | null>(null);

  scriptModalOpen = signal(false);
  scriptData = signal<WireguardScriptData | null>(null);
  copied = signal(false);

  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  form: any = {
    name: '',
    vpnServerId: '',
    vpnIp: '',
    clientPublicKey: '',
    clientPrivateKey: '',
    allowedIps: '10.200.0.0/24',
    description: '',
    isRadiusServer: false,
    isActive: true,
  };

  ngOnInit(): void {
    this.load();
    this.loadServers();
  }

  load(): void {
    this.api
      .get<{ data: VpnClient[]; meta: PageMeta }>(
        `/router/vpn-client?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  loadServers(): void {
    this.api
      .get<{ data: VpnServer[] }>('/router/vpn-server/options')
      .subscribe({
        next: (r) => {
          this.servers.set(r.data);
          if (!this.form.vpnServerId && r.data.length > 0) {
            this.form.vpnServerId = r.data[0].id;
          }
        },
        error: () => {},
      });
  }

  generateKeypair(): void {
    this.api.get<{ publicKey: string; privateKey: string }>('/router/vpn-client/keypair').subscribe({
      next: (r) => {
        this.form.clientPublicKey = r.publicKey;
        this.form.clientPrivateKey = r.privateKey;
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  show(item?: VpnClient): void {
    this.editing.set(item ?? null);
    if (item) {
      this.form = {
        name: item.name,
        vpnServerId: item.vpnServerId,
        vpnIp: item.vpnIp,
        clientPublicKey: item.clientPublicKey,
        clientPrivateKey: item.clientPrivateKey || '',
        allowedIps: item.allowedIps || '10.200.0.0/24',
        description: item.description || '',
        isRadiusServer: item.isRadiusServer,
        isActive: item.isActive,
      };
      this.open.set(true);
    } else {
      this.form = {
        name: '',
        vpnServerId: this.servers().length > 0 ? this.servers()[0].id : '',
        vpnIp: '',
        clientPublicKey: '',
        clientPrivateKey: '',
        allowedIps: '10.200.0.0/24',
        description: '',
        isRadiusServer: false,
        isActive: true,
      };
      this.generateKeypair();
      this.open.set(true);
    }
  }

  save(): void {
    const body = {
      ...this.form,
      vpnServerId: String(this.form.vpnServerId),
    };

    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/router/vpn-client/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/router/vpn-client', body);

    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(item: VpnClient): void {
    if (!confirm(`Hapus client WireGuard ${item.name}?`)) return;
    this.api.delete<{ message: string }>(`/router/vpn-client/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  openScript(item: VpnClient): void {
    this.api
      .get<WireguardScriptData>(`/router/vpn-client/${item.id}/script`)
      .subscribe({
        next: (r) => {
          this.scriptData.set(r);
          this.copied.set(false);
          this.scriptModalOpen.set(true);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  copyScript(): void {
    const data = this.scriptData();
    if (!data) return;
    navigator.clipboard.writeText(data.script).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}

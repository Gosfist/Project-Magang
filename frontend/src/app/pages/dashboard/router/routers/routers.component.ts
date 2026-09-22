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
  LucideWifi,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PageMeta, RouterItem, RouterScriptData, VpnClient } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-routers',
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
    LucideWifi,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './routers.component.html',
})
export class RoutersComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<RouterItem[]>([]);
  vpnClients = signal<VpnClient[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = '';
  page = signal(1);

  open = signal(false);
  editing = signal<RouterItem | null>(null);

  scriptModalOpen = signal(false);
  scriptData = signal<RouterScriptData | null>(null);
  scriptTab = signal<'ros7' | 'ros6'>('ros7');
  copied = signal(false);

  testingId = signal<string | null>(null);
  testResults = signal<Record<string, { success: boolean; message: string }>>({});

  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  form: any = {
    name: '',
    nasname: '',
    ipAddress: '',
    type: 'mikrotik',
    authMode: 'radius',
    username: '',
    password: '',
    port: 8728,
    ports: 1812,
    secret: '',
    vpnClientId: '',
    latitude: '',
    description: '',
    isActive: true,
  };

  ngOnInit(): void {
    this.load();
    this.loadVpnClients();
  }

  load(): void {
    this.api
      .get<{ data: RouterItem[]; meta: PageMeta }>(
        `/router/nas?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  loadVpnClients(): void {
    this.api
      .get<{ data: VpnClient[] }>('/router/vpn-client/options')
      .subscribe({
        next: (r) => this.vpnClients.set(r.data),
        error: () => {},
      });
  }

  generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 16; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  }

  randomizeSecret(): void {
    this.form.secret = this.generateSecret();
  }

  show(item?: RouterItem): void {
    this.editing.set(item ?? null);
    this.form = item
      ? {
          name: item.name ?? '',
          nasname: item.nasname,
          ipAddress: item.ipAddress ?? item.nasname,
          type: item.type || 'mikrotik',
          authMode: 'radius',
          username: item.username ?? '',
          password: '',
          port: item.port ?? 8728,
          ports: item.ports ?? 1812,
          secret: item.secret,
          vpnClientId: item.vpnClientId ?? '',
          latitude: item.latitude ?? '',
          description: item.description ?? '',
          isActive: item.isActive,
        }
      : {
          name: '',
          nasname: '',
          ipAddress: '',
          type: 'mikrotik',
          authMode: 'radius',
          username: '',
          password: '',
          port: 8728,
          ports: 1812,
          secret: this.generateSecret(),
          vpnClientId: '',
          latitude: '',
          description: '',
          isActive: true,
        };
    this.open.set(true);
  }

  onIpAddressChange(): void {
    if (!this.editing() && !this.form.nasname) {
      this.form.nasname = this.form.ipAddress;
    }
  }

  save(): void {
    const body = {
      ...this.form,
      port: Number(this.form.port) || 8728,
      ports: Number(this.form.ports) || 1812,
      latitude: this.form.latitude ? Number(this.form.latitude) : undefined,
      vpnClientId: this.form.vpnClientId || undefined,
      password: this.form.password || undefined,
    };

    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/router/nas/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/router/nas', body);

    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(item: RouterItem): void {
    if (!confirm(`Hapus router ${item.name || item.nasname}?`)) return;
    this.api.delete<{ message: string }>(`/router/nas/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  testConnection(item: RouterItem): void {
    this.testingId.set(item.id);
    this.api
      .post<{ success: boolean; message: string }>(`/router/nas/${item.id}/test`, {})
      .subscribe({
        next: (r) => {
          this.testingId.set(null);
          this.testResults.update((prev) => ({ ...prev, [item.id]: r }));
          this.toast.set({
            message: r.message,
            type: r.success ? 'success' : 'error',
          });
        },
        error: (e) => {
          this.testingId.set(null);
          this.testResults.update((prev) => ({
            ...prev,
            [item.id]: { success: false, message: e.message },
          }));
          this.toast.set({ message: e.message, type: 'error' });
        },
      });
  }

  openScript(item: RouterItem): void {
    this.api
      .get<RouterScriptData>(`/router/nas/${item.id}/script`)
      .subscribe({
        next: (r) => {
          this.scriptData.set(r);
          this.scriptTab.set('ros7');
          this.copied.set(false);
          this.scriptModalOpen.set(true);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  copyScript(): void {
    const data = this.scriptData();
    if (!data) return;
    const text = this.scriptTab() === 'ros7' ? data.scriptRos7 : data.scriptRos6;
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}

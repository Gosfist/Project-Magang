import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideShield,
  LucideTrash2,
} from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PageMeta, VpnServer } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-vpn-server',
  standalone: true,
  imports: [
    FormsModule,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideShield,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './vpn-server.component.html',
})
export class VpnServerComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<VpnServer[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = '';
  page = signal(1);

  open = signal(false);
  editing = signal<VpnServer | null>(null);

  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  form: any = {
    name: '',
    host: '',
    subnet: '10.200.0.0/24',
    wgPort: 51820,
    wgPublicKey: '',
    wgPrivateKey: '',
    poolStart: 10,
    poolEnd: 254,
    gateway: '',
    isActive: true,
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .get<{ data: VpnServer[]; meta: PageMeta }>(
        `/router/vpn-server?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  generateKeypair(): void {
    this.api.get<{ publicKey: string; privateKey: string }>('/router/vpn-server/keypair').subscribe({
      next: (r) => {
        this.form.wgPublicKey = r.publicKey;
        this.form.wgPrivateKey = r.privateKey;
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  show(item?: VpnServer): void {
    this.editing.set(item ?? null);
    if (item) {
      this.form = {
        name: item.name,
        host: item.host,
        subnet: item.subnet || '10.200.0.0/24',
        wgPort: item.wgPort || 51820,
        wgPublicKey: item.wgPublicKey,
        wgPrivateKey: item.wgPrivateKey || '',
        poolStart: item.poolStart ?? 10,
        poolEnd: item.poolEnd ?? 254,
        gateway: item.gateway || '',
        isActive: item.isActive,
      };
      this.open.set(true);
    } else {
      this.form = {
        name: '',
        host: '',
        subnet: '10.200.0.0/24',
        wgPort: 51820,
        wgPublicKey: '',
        wgPrivateKey: '',
        poolStart: 10,
        poolEnd: 254,
        gateway: '',
        isActive: true,
      };
      this.generateKeypair();
      this.open.set(true);
    }
  }

  save(): void {
    const body = {
      ...this.form,
      wgPort: Number(this.form.wgPort) || 51820,
      poolStart: Number(this.form.poolStart) || 10,
      poolEnd: Number(this.form.poolEnd) || 254,
      gateway: this.form.gateway?.trim() || undefined,
    };

    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/router/vpn-server/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/router/vpn-server', body);

    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(item: VpnServer): void {
    if (!confirm(`Hapus server WireGuard ${item.name}?`)) return;
    this.api.delete<{ message: string }>(`/router/vpn-server/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}

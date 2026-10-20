import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
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
import { latestRequest } from '../../../../core/services/latest-request';
import { PageMeta, RouterItem, RouterScriptData, VpnClientItem } from '../../../../shared/models/types';
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
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './routers.component.html',
})
export class RoutersComponent implements OnInit {
  private readonly latestLoad = latestRequest();
  private api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  items = signal<RouterItem[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = '';
  page = signal(1);

  open = signal(false);
  editing = signal<RouterItem | null>(null);

  scriptModalOpen = signal(false);
  scriptData = signal<RouterScriptData | null>(null);
  copied = signal(false);
  confirming = signal(false);
  scriptInstalled = false;
  scriptMode = signal<'install' | 'update'>('install');
  scriptRouterId: string | null = null;

  saving = signal(false);

  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  form = this.emptyForm();
  vpnClients = signal<VpnClientItem[]>([]);

  private emptyForm() {
    return { vpnClientId: '', name: '', nasname: '', ipAddress: '', ports: 1812,
      coaPort: 3799, radiusServerIp: '', secret: '', vpnHost: '', vpnUsername: '',
      vpnPassword: '', description: '', isActive: true, internetCidr: '', isolationCidr: '' };
  }

  ngOnInit(): void {
    this.load();
    timer(15000, 15000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load(): void {
    this.api
      .get<{ data: RouterItem[]; meta: PageMeta }>(
        `/router/nas?search=${encodeURIComponent(this.search)}&page=${this.page()}`,
      )
      .pipe(this.latestLoad).subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => chars[value % chars.length]).join('');
  }

  randomizeSecret(): void {
    this.form.secret = this.generateSecret();
  }

  show(item?: RouterItem): void {
    this.api.get<{ data: VpnClientItem[] }>('/router/vpn-clients').subscribe({ next: r => this.vpnClients.set(r.data), error: e => this.toast.set({ message: e.message, type: 'error' }) });
    this.editing.set(item ?? null);
    this.form = item
      ? {
          vpnClientId: item.vpnClientId ?? '',
          name: item.name ?? '',
          nasname: item.nasname,
          ipAddress: item.ipAddress ?? item.nasname,
          ports: item.ports ?? 1812,
          coaPort: item.coaPort ?? 3799,
          radiusServerIp: item.radiusServerIp ?? '',
          secret: '',
          vpnHost: item.vpnHost ?? '',
          vpnUsername: item.vpnUsername ?? '',
          vpnPassword: '',
          description: item.description ?? '',
          isActive: item.isActive,
          internetCidr: item.internetCidr ?? '',
          isolationCidr: item.isolationCidr ?? '',
        }
      : this.emptyForm();
    this.open.set(true);
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const body = {
      ...this.form,
      vpnClientId: this.form.vpnClientId || null,
      ipAddress: this.form.ipAddress || undefined,
      radiusServerIp: this.form.radiusServerIp || undefined,
      ports: Number(this.form.ports) || 1812,
      coaPort: Number(this.form.coaPort) || 3799,
      secret: this.form.secret || undefined,
      vpnPassword: this.form.vpnPassword || undefined,
    };

    const req = this.editing()
      ? this.api.patch<{ message: string; router: { id: string }; setup: RouterScriptData }>(`/router/nas/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; router: { id: string }; setup: RouterScriptData }>('/router/nas', body);

    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.form.vpnPassword = '';
        this.form.secret = '';
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.scriptRouterId = r.router?.id ?? this.editing()?.id ?? null;
        this.showScript(r.setup);
        this.load();
      },
      error: (e) => { this.saving.set(false); this.toast.set({ message: e.message, type: 'error' }); },
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

  selectVpn(): void {
    this.form.vpnHost = ''; this.form.vpnUsername = ''; this.form.vpnPassword = '';
    const client = this.vpnClients().find(c => c.id === this.form.vpnClientId);
    if (client) {
      this.form.nasname = client.vpnIp; this.form.ipAddress = client.vpnIp;
      this.form.radiusServerIp = '10.88.0.1';
    }
  }

  openScript(item: RouterItem): void {
    this.api
      .get<RouterScriptData>(`/router/nas/${item.id}/script`)
      .subscribe({
        next: (r) => { this.scriptRouterId = item.id; this.showScript(r); },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  private showScript(data: RouterScriptData): void {
    this.scriptData.set(data);
    this.scriptMode.set('install');
    this.copied.set(false);
    this.scriptInstalled = false;
    this.scriptModalOpen.set(true);
  }

  closeForm(): void {
    this.open.set(false);
    this.form.vpnPassword = '';
    this.form.secret = '';
  }

  closeScript(): void {
    if (this.confirming()) return;
    this.scriptModalOpen.set(false);
    this.scriptData.set(null);
    this.scriptRouterId = null;
    this.scriptInstalled = false;
  }

  changeScriptMode(mode: 'install' | 'update'): void {
    this.scriptMode.set(mode);
    this.copied.set(false);
    this.scriptInstalled = false;
  }

  confirmNetwork(): void {
    const data = this.scriptData(), id = this.scriptRouterId;
    if (!id || !data?.networkFingerprint || !this.scriptInstalled || this.confirming()) return;
    this.confirming.set(true);
    this.api.post<{ message: string }>(`/router/nas/${id}/network/confirm`, { fingerprint: data.networkFingerprint }).subscribe({
      next: result => {
        this.confirming.set(false);
        this.scriptData.set({ ...data, networkNeedsConfirmation: false });
        this.toast.set({ message: result.message, type: 'success' }); this.load();
      },
      error: error => { this.confirming.set(false); this.toast.set({ message: error.message, type: 'error' }); },
    });
  }

  copyScript(): void {
    const data = this.scriptData();
    if (!data) return;
    if (!navigator.clipboard) {
      this.toast.set({ message: 'Pilih dan salin script secara manual, atau buka aplikasi melalui HTTPS untuk penyalinan otomatis.', type: 'error' });
      return;
    }
    const script = this.scriptMode() === 'install' ? data.scriptInstall : data.scriptUpdate;
    navigator.clipboard.writeText(script).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => this.toast.set({ message: 'Penyalinan otomatis tidak tersedia. Pilih dan salin script secara manual.', type: 'error' }));
  }
}

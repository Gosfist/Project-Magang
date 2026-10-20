import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { VpnClientItem } from '../../../../shared/models/types';

@Component({
  selector: 'app-vpn-client', standalone: true, imports: [FormsModule, ModalComponent, ToastComponent],
  template: `
    <div class="card p-4 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm">Server SSTP: {{ server() || 'Belum tersedia' }}</p><div class="flex gap-2"><button class="btn-secondary" (click)="load()">Muat Ulang</button><button class="btn-primary" (click)="show()">Tambah VPN</button></div></div>
      <p class="text-sm text-slate-500">Buat satu akun untuk setiap router. Setelah status Siap, pilih akun ini di Router / NAS. Siap berarti akun sudah terpasang di server VPN.</p>
      <div class="table-wrap"><table><thead><tr><th>No</th><th>Nama</th><th>Username</th><th>Password</th><th>IP VPN</th><th>Status</th><th>Router / NAS</th></tr></thead><tbody>
        @for (item of items(); track item.id; let i = $index) {
          <tr><td>{{ i + 1 }}</td><td>{{ item.name }}</td><td>{{ item.username }}</td><td><div class="flex items-center gap-2"><span class="font-mono">{{ passwords()[item.id] || '••••••••' }}</span><button class="text-sm underline" [attr.aria-label]="'Tampilkan atau sembunyikan password ' + item.username" (click)="toggle(item)">{{ passwords()[item.id] ? 'Sembunyikan' : 'Tampilkan' }}</button></div></td><td>{{ item.vpnIp }}</td><td>{{ item.provisionedAt ? 'Siap' : 'Menunggu server' }}</td><td>{{ item.routers.at(0)?.name || '-' }}</td></tr>
        } @empty { <tr><td colspan="7" class="py-8 text-center text-slate-500">Klien VPN belum tersedia.</td></tr> }
      </tbody></table></div>
    </div>
    <app-modal [open]="open()" title="Tambah Klien VPN" (closeModal)="close()"><form class="space-y-4" (ngSubmit)="save()">
      <div><label class="label" for="vpn-name">Nama *</label><input id="vpn-name" class="input" name="name" required maxlength="100" [(ngModel)]="form.name" placeholder="Router Cabang 1" /></div>
      <div><label class="label" for="vpn-username">Username *</label><input id="vpn-username" class="input" name="username" required pattern="[a-zA-Z0-9_-]{1,64}" maxlength="64" autocomplete="off" [(ngModel)]="form.username" placeholder="vpn_router01" /></div>
      <div><label class="label" for="vpn-password">Password</label><input id="vpn-password" class="input" type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" [(ngModel)]="form.password" /><p class="text-xs text-slate-500 mt-1">Kosongkan untuk password acak. Password manual minimal 12 karakter; gunakan huruf, angka, atau _!&#64;%+=.,:-</p></div>
      <div class="flex justify-end gap-2"><button class="btn-secondary" type="button" (click)="close()">Batal</button><button class="btn-primary" [disabled]="saving()">{{ saving() ? 'Menyimpan...' : 'Buat Akun VPN' }}</button></div>
    </form></app-modal>
    @if (toast()) { <app-toast [message]="toast()!.message" [type]="toast()!.type" (close)="toast.set(null)" /> }
  `,
})
export class VpnClientComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private timer?: ReturnType<typeof setInterval>;
  items = signal<VpnClientItem[]>([]);
  passwords = signal<Record<string, string>>({});
  server = signal(''); open = signal(false); saving = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  form = { name: '', username: '', password: '' };
  ngOnInit() { this.load(); this.timer = setInterval(() => { if (this.items().some(c => !c.provisionedAt)) this.load(); }, 15000); }
  ngOnDestroy() { clearInterval(this.timer); this.passwords.set({}); }
  show() { this.form = { name: '', username: '', password: '' }; this.open.set(true); }
  close() { this.form.password = ''; this.open.set(false); }
  load() { this.api.get<{ data: VpnClientItem[]; server: { host: string; port: number } }>('/router/vpn-clients').subscribe({ next: r => { this.items.set(r.data); this.server.set(r.server.host + ':' + r.server.port); }, error: e => this.toast.set({ message: e.message, type: 'error' }) }); }
  toggle(item: VpnClientItem) {
    if (this.passwords()[item.id]) { this.passwords.update(p => { const copy = { ...p }; delete copy[item.id]; return copy; }); return; }
    this.api.get<{ password: string }>(`/router/vpn-clients/${item.id}/credentials`).subscribe({ next: r => this.passwords.update(p => ({ ...p, [item.id]: r.password })), error: e => this.toast.set({ message: e.message, type: 'error' }) });
  }
  save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.post<{ message: string }>('/router/vpn-clients', { ...this.form, password: this.form.password || undefined }).subscribe({ next: r => { this.saving.set(false); this.close(); this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => { this.saving.set(false); this.toast.set({ message: e.message, type: 'error' }); } });
  }
}

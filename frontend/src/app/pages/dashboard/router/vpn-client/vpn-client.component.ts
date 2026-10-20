import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { VpnClientItem } from '../../../../shared/models/types';

@Component({
  selector: 'app-vpn-client', standalone: true, imports: [FormsModule, LucidePencil, LucidePlus, LucideTrash2, ModalComponent, ToastComponent],
  template: `
    <div class="space-y-4">
      <div class="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p class="text-sm">Server SSTP: {{ server() || 'Belum tersedia' }}</p>
        <div class="flex gap-3">
          <button type="button" class="btn-secondary" (click)="load()">Muat Ulang</button>
          <button type="button" class="btn-primary" (click)="show()"><svg lucidePlus [size]="18"></svg> Tambah VPN</button>
        </div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>No</th><th>Nama</th><th>Username</th><th>Password</th><th>IP VPN</th><th>Router / NAS</th><th>Aksi</th></tr></thead><tbody>
        @for (item of items(); track item.id; let i = $index) {
          <tr><td>{{ i + 1 }}</td><td>{{ item.name }}</td><td>{{ item.username }}</td><td class="break-all">{{ item.password || '-' }}</td><td>{{ item.vpnIp }}</td><td>{{ item.routers.at(0)?.name || '-' }}</td><td><div class="flex gap-2">
            <button type="button" class="btn-secondary table-action table-action-icon" (click)="show(item)" title="Edit" [attr.aria-label]="'Edit ' + item.name"><svg lucidePencil [size]="14"></svg></button>
            <button type="button" class="btn-danger table-action table-action-icon" (click)="remove(item)" title="Hapus" [attr.aria-label]="'Hapus ' + item.name"><svg lucideTrash2 [size]="14"></svg></button>
          </div></td></tr>
        } @empty { <tr><td colspan="7" class="py-8 text-center text-slate-500">Klien VPN belum tersedia.</td></tr> }
      </tbody></table></div>
    </div>
    <app-modal [open]="open()" [title]="editing() ? 'Edit Klien VPN' : 'Tambah Klien VPN'" (closeModal)="close()"><form class="space-y-4" (ngSubmit)="save()">
      <div><label class="label" for="vpn-name">Nama *</label><input id="vpn-name" class="input" name="name" required maxlength="100" [(ngModel)]="form.name" placeholder="Router Cabang 1" /></div>
      <div><label class="label" for="vpn-username">Username *</label><input id="vpn-username" class="input" name="username" required pattern="[a-zA-Z0-9_-]{1,64}" maxlength="64" autocomplete="off" [(ngModel)]="form.username" placeholder="vpn_router01" /></div>
      <div><label class="label" for="vpn-password">Password</label><input id="vpn-password" class="input" type="text" name="password" minlength="12" maxlength="128" autocomplete="off" [(ngModel)]="form.password" /><p class="text-xs text-slate-500 mt-1">{{ editing() ? 'Kosongkan untuk mempertahankan password.' : 'Kosongkan untuk password acak.' }} Password manual minimal 12 karakter; gunakan huruf, angka, atau _!&#64;%+=.,:-</p></div>
      <div class="flex justify-end gap-2"><button class="btn-secondary" type="button" (click)="close()" [disabled]="saving()">Batal</button><button class="btn-primary" [disabled]="saving()">{{ saving() ? 'Menyimpan...' : editing() ? 'Simpan Perubahan' : 'Buat Akun VPN' }}</button></div>
    </form></app-modal>
    <app-modal [open]="!!deleting()" title="Hapus Klien VPN" (closeModal)="cancelRemove()">
      <p>Hapus akun VPN {{ deleting()?.name }}?</p>
      <div class="flex justify-end gap-2 mt-4"><button type="button" class="btn-secondary" (click)="cancelRemove()" [disabled]="removing()">Batal</button><button type="button" class="btn-danger" (click)="confirmRemove()" [disabled]="removing()">{{ removing() ? 'Menghapus...' : 'Hapus' }}</button></div>
    </app-modal>
    @if (toast()) { <app-toast [message]="toast()!.message" [type]="toast()!.type" (close)="toast.set(null)" /> }
  `,
})
export class VpnClientComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly latestLoad = latestRequest();
  private timer?: ReturnType<typeof setInterval>;
  items = signal<VpnClientItem[]>([]);
  editing = signal<VpnClientItem | null>(null);
  deleting = signal<VpnClientItem | null>(null);
  removing = signal(false);
  server = signal(''); open = signal(false); saving = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  form = { name: '', username: '', password: '' };
  ngOnInit() { this.load(); this.timer = setInterval(() => { if (this.items().some(c => !c.provisionedAt)) this.load(); }, 15000); }
  ngOnDestroy() { clearInterval(this.timer); this.items.set([]); this.form.password = ''; this.editing.set(null); this.deleting.set(null); }
  show(item?: VpnClientItem) {
    this.editing.set(item ?? null);
    this.form = item ? { name: item.name, username: item.username, password: item.password ?? '' } : { name: '', username: '', password: '' };
    this.open.set(true);
  }
  close() { if (this.saving()) return; this.form.password = ''; this.editing.set(null); this.open.set(false); }
  load() { this.api.get<{ data: VpnClientItem[]; server: { host: string; port: number } }>('/router/vpn-clients?credentials=1').pipe(this.latestLoad).subscribe({ next: r => { this.items.set(r.data); this.server.set(r.server.host + ':' + r.server.port); }, error: e => this.toast.set({ message: e.message, type: 'error' }) }); }
  remove(item: VpnClientItem) { this.deleting.set(item); }
  cancelRemove() { if (!this.removing()) this.deleting.set(null); }
  confirmRemove() {
    const item = this.deleting();
    if (!item || this.removing()) return;
    this.removing.set(true);
    this.api.delete<{ message: string }>(`/router/vpn-clients/${item.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => { this.removing.set(false); this.deleting.set(null); this.toast.set({ message: r.message, type: 'success' }); this.load(); },
      error: e => { this.removing.set(false); this.toast.set({ message: e.message, type: 'error' }); },
    });
  }
  save() {
    if (this.saving()) return;
    this.saving.set(true);
    const item = this.editing();
    const body = { ...this.form, password: this.form.password || undefined };
    const request = item ? this.api.patch<{ message: string }>(`/router/vpn-clients/${item.id}`, body) : this.api.post<{ message: string }>('/router/vpn-clients', body);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => { this.saving.set(false); this.close(); this.toast.set({ message: r.message, type: 'success' }); this.load(); }, error: e => { this.saving.set(false); this.toast.set({ message: e.message, type: 'error' }); } });
  }
}

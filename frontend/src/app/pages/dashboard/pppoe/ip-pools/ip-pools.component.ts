import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { IpPool, PageMeta } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-pppoe-ip-pools',
  standalone: true,
  imports: [
    FormsModule,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideTrash2,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './ip-pools.component.html',
})
export class IpPoolsComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<IpPool[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = '';
  page = signal(1);
  open = signal(false);
  editing = signal<IpPool | null>(null);
  routers = signal<{ id: number; nasname: string; shortname: string }[]>([]);
  saving = signal(false);
  form = { routerNasId: 0, name: '', networkStart: '', networkEnd: '' };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
    this.api.get<{ data: { id: number; nasname: string; shortname: string }[] }>('/pppoe/nas/options').subscribe({
      next: (r) => this.routers.set(r.data),
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  load(): void {
    this.api
      .get<{ data: IpPool[]; meta: PageMeta; warnings?: string[] }>(
        `/pppoe/ip-pools?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
          if (r.warnings?.length) this.toast.set({ message: r.warnings.join(" "), type: "error" });
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(item?: IpPool): void {
    this.editing.set(item ?? null);
    this.form = item
      ? {
          routerNasId: item.routerNasId,
          name: item.name,
          networkStart: item.networkStart,
          networkEnd: item.networkEnd,
        }
      : { routerNasId: 0, name: '', networkStart: '', networkEnd: '' };
    this.open.set(true);
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const body = {
      routerNasId: Number(this.form.routerNasId),
      name: this.form.name,
      networkStart: this.form.networkStart,
      networkEnd: this.form.networkEnd,
    };
    const req = this.editing()
      ? this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/ip-pools/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; warnings?: string[] }>('/pppoe/ip-pools', body);
    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => { this.saving.set(false); this.toast.set({ message: e.message, type: 'error' }); },
    });
  }

  remove(item: IpPool): void {
    if (!confirm(`Hapus IP pool ${item.name}?`)) return;
    this.api.delete<{ message: string; warnings?: string[] }>(`/pppoe/ip-pools/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}

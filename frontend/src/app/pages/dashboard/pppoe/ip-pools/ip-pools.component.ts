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
  form = { name: '', networkStart: '', networkEnd: '' };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api
      .get<{ data: IpPool[]; meta: PageMeta }>(
        `/pppoe/ip-pools?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(item?: IpPool): void {
    this.editing.set(item ?? null);
    this.form = item
      ? {
          name: item.name,
          networkStart: item.networkStart,
          networkEnd: item.networkEnd,
        }
      : { name: '', networkStart: '', networkEnd: '' };
    this.open.set(true);
  }

  save(): void {
    const body = {
      name: this.form.name,
      networkStart: this.form.networkStart,
      networkEnd: this.form.networkEnd,
    };
    const req = this.editing()
      ? this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/ip-pools/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; warnings?: string[] }>('/pppoe/ip-pools', body);
    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  syncing = signal<string | null>(null);

  sync(item: IpPool): void {
    if (this.syncing()) return;
    this.syncing.set(String(item.id));
    this.api.post<{ message: string; warnings?: string[] }>(`/pppoe/ip-pools/${item.id}/sync`, {}).subscribe({
      next: (r) => {
        this.syncing.set(null);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
      },
      error: (e) => { this.syncing.set(null); this.toast.set({ message: e.message, type: 'error' }); },
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

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PppoePackage, PageMeta, IpPool } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-pppoe-paket-layanan',
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
  templateUrl: './paket-layanan.component.html',
})
export class PaketLayananComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<PppoePackage[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  search = '';
  page = signal(1);
  open = signal(false);
  editing = signal<PppoePackage | null>(null);
  form = { name: '', downloadMbps: '', uploadMbps: '', price: '', costPrice: '', addressPool: '', ipPoolId: '', validityDays: '30' };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  ipPools = signal<IpPool[]>([]);

  ngOnInit(): void {
    this.load();
    this.api.get<{ data: IpPool[]; warnings?: string[] }>('/pppoe/ip-pools/options').subscribe({ next: (r) => {
      this.ipPools.set(r.data.filter((pool, index, all) => all.findIndex((p) => p.name === pool.name) === index));
      if (r.warnings?.length) this.toast.set({ message: r.warnings.join(' '), type: 'error' });
    }, error: (e) => this.toast.set({ message: e.message, type: 'error' }) });
  }

  formatPrice(price: number): string {
    return price.toLocaleString('id-ID');
  }

  load(): void {
    this.api
      .get<{ data: PppoePackage[]; meta: PageMeta }>(
        `/pppoe/packages?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(item?: PppoePackage): void {
    this.editing.set(item ?? null);
    this.form = item
      ? {
          name: item.name,
          downloadMbps: String(item.downloadMbps),
          uploadMbps: String(item.uploadMbps),
          price: String(item.price),
          costPrice: String(item.costPrice ?? ''),
          addressPool: item.addressPool || item.ipPool?.name || '',
          ipPoolId: item.ipPool?.id ?? '',
          validityDays: String(item.validityDays ?? 30),
        }
      : { name: '', downloadMbps: '', uploadMbps: '', price: '', costPrice: '', addressPool: '', ipPoolId: '', validityDays: '30' };
    this.open.set(true);
  }

  save(): void {
    const body = {
      name: this.form.name,
      downloadMbps: Number(this.form.downloadMbps),
      uploadMbps: Number(this.form.uploadMbps),
      price: Number(this.form.price),
      costPrice: Number(this.form.costPrice),
      addressPool: this.form.addressPool || undefined,
      validityDays: Number(this.form.validityDays),
    };
    const req = this.editing()
      ? this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/packages/${this.editing()!.id}`, body)
      : this.api.post<{ message: string; warnings?: string[] }>('/pppoe/packages', body);
    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  toggleStatus(item: PppoePackage): void {
    this.api.patch<{ message: string; warnings?: string[] }>(`/pppoe/packages/${item.id}/status`, {}).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(item: PppoePackage): void {
    if (!confirm(`Hapus paket ${item.name}?`)) return;
    this.api.delete<{ message: string; warnings?: string[] }>(`/pppoe/packages/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}

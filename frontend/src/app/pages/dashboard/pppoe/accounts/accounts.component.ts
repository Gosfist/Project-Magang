import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { PppoeAccount, PppoePackage, PageMeta } from '../../../../shared/models/types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-pppoe-accounts',
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
  templateUrl: './accounts.component.html',
})
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<PppoeAccount[]>([]);
  packages = signal<PppoePackage[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  search = '';
  page = signal(1);
  open = signal(false);
  editing = signal<PppoeAccount | null>(null);
  form: any = {
    pppoePackageId: '',
    customerName: '',
    username: '',
    password: '',
    phone: '',
    address: '',
    expiresAt: '',
    isActive: true,
    notes: '',
  };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
    this.api.get<{ data: PppoePackage[] }>('/pppoe/packages/options').subscribe({
      next: (r) => this.packages.set(r.data),
    });
  }

  load(): void {
    this.api
      .get<{ data: PppoeAccount[]; meta: PageMeta }>(
        `/pppoe/accounts?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  show(item?: PppoeAccount): void {
    this.editing.set(item ?? null);
    this.form = item
      ? {
          pppoePackageId: item.pppoePackageId,
          customerName: item.customerName,
          username: item.username,
          password: '',
          phone: item.phone ?? '',
          address: item.address ?? '',
          expiresAt: item.expiresAt?.slice(0, 10) ?? '',
          isActive: item.isActive,
          notes: item.notes ?? '',
        }
      : {
          pppoePackageId: '',
          customerName: '',
          username: '',
          password: '',
          phone: '',
          address: '',
          expiresAt: '',
          isActive: true,
          notes: '',
        };
    this.open.set(true);
  }

  save(): void {
    const body = {
      ...this.form,
      password: this.form.password || undefined,
      expiresAt: this.form.expiresAt || undefined,
    };
    const req = this.editing()
      ? this.api.patch<{ message: string }>(`/pppoe/accounts/${this.editing()!.id}`, body)
      : this.api.post<{ message: string }>('/pppoe/accounts', body);
    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(item: PppoeAccount): void {
    if (!confirm(`Hapus akun ${item.username}?`)) return;
    this.api.delete<{ message: string }>(`/pppoe/accounts/${item.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}

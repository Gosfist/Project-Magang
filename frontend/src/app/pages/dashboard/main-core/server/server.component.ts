import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { MainCoreNode, NasOption, PageMeta } from '../../../../shared/models/types';

const emptyServerForm = { namaTitik: '', redamanIn: '', routerNasId: '' };

@Component({
  selector: 'app-server',
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
  templateUrl: './server.component.html',
})
export class ServerComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<MainCoreNode[]>([]);
  routers = signal<NasOption[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  page = signal(1);
  search = '';
  open = signal(false);
  editing = signal<MainCoreNode | null>(null);
  form = { ...emptyServerForm };
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
    this.api.get<{ data: NasOption[] }>('/pppoe/nas/options').subscribe({
      next: (response) => this.routers.set(response.data),
      error: (error) => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  load(): void {
    this.api
      .get<{ data: MainCoreNode[]; meta: PageMeta }>(
        `/main-core/server?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.meta.set(response.meta);
        },
        error: (error) => this.toast.set({ message: error.message, type: 'error' }),
      });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('id-ID');
  }

  show(node?: MainCoreNode): void {
    this.editing.set(node ?? null);
    this.form = node
      ? { namaTitik: node.namaTitik, redamanIn: String(node.redamanIn ?? ''), routerNasId: String(node.routerNasId ?? '') }
      : { ...emptyServerForm };
    this.open.set(true);
  }

  save(): void {
    const editing = this.editing();
    const body = {
      namaTitik: this.form.namaTitik,
      redamanIn: this.form.redamanIn === '' ? undefined : Number(this.form.redamanIn),
      routerNasId: this.form.routerNasId,
    };
    const request = editing
      ? this.api.patch<{ message: string }>(`/main-core/server/${editing.id}`, body)
      : this.api.post<{ message: string }>('/main-core/server', body);

    request.subscribe({
      next: (response) => {
        this.open.set(false);
        this.toast.set({ message: response.message, type: 'success' });
        this.load();
      },
      error: (error) => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  remove(node: MainCoreNode): void {
    if (!confirm(`Hapus ${node.namaTitik}?`)) return;
    this.api.delete<{ message: string }>(`/main-core/server/${node.id}`).subscribe({
      next: (response) => {
        this.toast.set({ message: response.message, type: 'success' });
        this.load();
      },
      error: (error) => this.toast.set({ message: error.message, type: 'error' }),
    });
  }
}

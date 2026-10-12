import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { latestRequest } from '../../../../core/services/latest-request';
import { PageMeta } from '../../../../shared/models/types';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
interface PromiseRow { id: string; promisedDate: string; status: string; notes: string | null;
  account: { customerNumber: string; customerName: string; phone: string | null }; }
@Component({ selector: 'app-collector-promises', standalone: true, imports: [FormsModule, PaginationComponent],
  templateUrl: './collector-promises.component.html' })
export class CollectorPromisesComponent implements OnInit {
  private readonly latestLoad = latestRequest();
  private api = inject(ApiService);
  items = signal<PromiseRow[]>([]); loading = signal(false); error = signal('');
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  search = ''; page = 1; private requestId = 0;
  ngOnInit() { this.load(); }
  load(page = 1) {
    this.page = page; const id = ++this.requestId;
    this.loading.set(true); this.error.set('');
    this.api.get<{ data: PromiseRow[]; meta: PageMeta }>(`/areas/promises?search=${encodeURIComponent(this.search)}&page=${page}`).pipe(this.latestLoad).subscribe({
      next: result => { if (id !== this.requestId) return; this.items.set(result.data); this.meta.set(result.meta); this.loading.set(false); },
      error: err => { if (id !== this.requestId) return; this.error.set(err.message); this.items.set([]); this.loading.set(false); },
    });
  }
  date(value: string) { return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }); }
  status(value: string) { return ({ ACTIVE: 'Aktif', EXPIRED: 'Kedaluwarsa', FULFILLED: 'Selesai' } as Record<string, string>)[value] || value; }
}

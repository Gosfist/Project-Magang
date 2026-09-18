import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Area, PageMeta } from '../../../shared/models/types';

@Component({
  selector: 'app-area',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900">Data Area</h1>
        @if (auth.isAdmin()) {
          <button (click)="openModal()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Tambah Area</button>
        }
      </div>

      <input type="text" placeholder="Cari area..." [(ngModel)]="search" (ngModelChange)="load()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-72" />

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @if (loading()) {
          <div class="col-span-full flex justify-center py-12"><div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div></div>
        } @else if (areas().length === 0) {
          <div class="col-span-full text-center py-12 text-slate-400">Belum ada area.</div>
        } @else {
          @for (area of areas(); track area.id) {
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-slate-900">{{ area.name }}</h3>
                  @if (area.description) {
                    <p class="mt-1 text-sm text-slate-500">{{ area.description }}</p>
                  }
                </div>
                @if (auth.isAdmin()) {
                  <div class="flex gap-1">
                    <button (click)="openModal(area)" class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button (click)="remove(area)" class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Hapus">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                }
              </div>

              <div class="mt-3 flex items-center gap-4 text-sm text-slate-500">
                <span>📍 {{ area.accountsCount || 0 }} pelanggan</span>
                <span>👤 {{ area.collectors?.length || 0 }} pengepul</span>
              </div>

              <!-- Collectors list -->
              @if (area.collectors && area.collectors.length > 0) {
                <div class="mt-3 space-y-1">
                  <p class="text-xs font-medium text-slate-500 uppercase">Pengepul:</p>
                  @for (c of area.collectors; track c.id) {
                    <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                      <div>
                        <span class="text-sm font-medium text-slate-700">{{ c.user?.name }}</span>
                        <span class="ml-2 text-xs text-slate-400">{{ c.user?.phone || '' }}</span>
                      </div>
                      @if (auth.isAdmin()) {
                        <button (click)="removeCollector(area, c.userId)" class="text-xs text-red-500 hover:text-red-700">Hapus</button>
                      }
                    </div>
                  }
                </div>
              }

              @if (auth.isAdmin()) {
                <button (click)="openAssignModal(area)" class="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600">+ Tambah Pengepul</button>
              }
            </div>
          }
        }
      </div>

      <!-- Pagination -->
      @if (meta()) {
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">{{ meta()!.total }} area</p>
          <div class="flex gap-2">
            <button [disabled]="page === 1" (click)="page = page - 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Sebelumnya</button>
            <button [disabled]="page >= (meta()?.lastPage || 1)" (click)="page = page + 1; load()" class="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Selanjutnya</button>
          </div>
        </div>
      }
    </div>

    <!-- Create/Edit Area Modal -->
    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeModal()">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold text-slate-900 mb-4">{{ editing ? 'Edit' : 'Tambah' }} Area</h2>
          <form (submit)="save($event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nama Area</label>
              <input type="text" [(ngModel)]="form.name" name="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Cth: Area Kecamatan Utara" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi (opsional)</label>
              <textarea [(ngModel)]="form.description" name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Deskripsi area..."></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" (click)="closeModal()" class="rounded-lg border px-4 py-2 text-sm">Batal</button>
              <button type="submit" [disabled]="saving()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {{ saving() ? 'Menyimpan...' : 'Simpan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Assign Collector Modal -->
    @if (assignModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="assignModalOpen.set(false)">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold text-slate-900 mb-4">Tambah Pengepul ke {{ assignArea?.name }}</h2>
          @if (collectorOptions().length === 0) {
            <p class="text-sm text-slate-500 py-4">Tidak ada pengepul tersedia. Buat user dengan role pengepul terlebih dahulu.</p>
          } @else {
            <div class="space-y-2 max-h-64 overflow-y-auto">
              @for (c of collectorOptions(); track c.id) {
                <button (click)="assignCollector(c.id)" class="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50">
                  <span class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{{ c.name[0] }}</span>
                  <div>
                    <p class="text-sm font-medium text-slate-900">{{ c.name }}</p>
                    <p class="text-xs text-slate-400">{{ c.email }}</p>
                  </div>
                </button>
              }
            </div>
          }
          <div class="flex justify-end pt-4">
            <button (click)="assignModalOpen.set(false)" class="rounded-lg border px-4 py-2 text-sm">Tutup</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AreaComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  modalOpen = signal(false);
  assignModalOpen = signal(false);
  areas = signal<Area[]>([]);
  meta = signal<PageMeta | null>(null);
  collectorOptions = signal<{ id: string; name: string; email: string }[]>([]);

  search = '';
  page = 1;
  editing: Area | null = null;
  assignArea: Area | null = null;
  form = { name: '', description: '' };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    params.set('page', String(this.page));

    this.api.get<{ data: Area[]; meta: PageMeta }>(`/areas?${params}`).subscribe({
      next: (res) => { this.areas.set(res.data); this.meta.set(res.meta); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openModal(area?: Area) {
    this.editing = area || null;
    this.form = area ? { name: area.name, description: area.description || '' } : { name: '', description: '' };
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); this.editing = null; }

  save(event: Event) {
    event.preventDefault();
    this.saving.set(true);
    const obs = this.editing
      ? this.api.patch(`/areas/${this.editing.id}`, this.form)
      : this.api.post('/areas', this.form);
    obs.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  remove(area: Area) {
    if (!confirm(`Hapus area "${area.name}"?`)) return;
    this.api.delete(`/areas/${area.id}`).subscribe({ next: () => this.load() });
  }

  openAssignModal(area: Area) {
    this.assignArea = area;
    this.api.get<{ data: { id: string; name: string; email: string }[] }>('/areas/collector-options').subscribe({
      next: (res) => { this.collectorOptions.set(res.data); this.assignModalOpen.set(true); },
    });
  }

  assignCollector(userId: string) {
    if (!this.assignArea) return;
    this.api.post(`/areas/${this.assignArea.id}/collectors`, { userId }).subscribe({
      next: () => { this.assignModalOpen.set(false); this.load(); },
    });
  }

  removeCollector(area: Area, userId: string) {
    if (!confirm('Hapus pengepul ini dari area?')) return;
    this.api.delete(`/areas/${area.id}/collectors/${userId}`).subscribe({ next: () => this.load() });
  }
}

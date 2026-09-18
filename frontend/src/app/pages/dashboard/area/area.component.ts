import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideSearch,
  LucidePlus,
  LucidePencil,
  LucideTrash2,
  LucideMapPin,
  LucideUserPlus,
  LucideX,
} from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Area, PageMeta } from '../../../shared/models/types';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-area',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
    LucideSearch,
    LucidePlus,
    LucidePencil,
    LucideTrash2,
    LucideMapPin,
    LucideUserPlus,
    LucideX,
  ],
  templateUrl: './area.component.html',
  styleUrl: './area.component.css',
})
export class AreaComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  assigning = signal(false);
  modalOpen = signal(false);
  assignModalOpen = signal(false);
  areas = signal<Area[]>([]);
  meta = signal<PageMeta | null>(null);
  collectorOptions = signal<{ id: string; name: string; email: string }[]>([]);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  search = '';
  page = signal(1);
  editing: Area | null = null;
  assignArea: Area | null = null;
  selectedCollectorId = '';
  form = { name: '', description: '' };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    params.set('page', String(this.page()));

    this.api.get<{ data: Area[]; meta: PageMeta }>(`/areas?${params}`).subscribe({
      next: (res) => {
        this.areas.set(res.data);
        this.meta.set(res.meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.set({ message: err.message || 'Gagal memuat data area', type: 'error' });
      },
    });
  }

  openModal(area?: Area) {
    this.editing = area || null;
    this.form = area
      ? { name: area.name, description: area.description || '' }
      : { name: '', description: '' };
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editing = null;
  }

  save(event: Event) {
    event.preventDefault();
    if (!this.form.name.trim()) return;
    this.saving.set(true);
    const obs = this.editing
      ? this.api.patch(`/areas/${this.editing.id}`, this.form)
      : this.api.post('/areas', this.form);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.set({
          message: `Area berhasil ${this.editing ? 'diperbarui' : 'ditambahkan'}.`,
          type: 'success',
        });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.set({ message: err.message || 'Gagal menyimpan area', type: 'error' });
      },
    });
  }

  remove(area: Area) {
    if (!confirm(`Hapus area "${area.name}"? Pelanggan di area ini akan menjadi tanpa area.`)) return;
    this.api.delete(`/areas/${area.id}`).subscribe({
      next: () => {
        this.toast.set({ message: `Area "${area.name}" berhasil dihapus.`, type: 'success' });
        this.load();
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal menghapus area', type: 'error' });
      },
    });
  }

  openAssignModal(area: Area) {
    this.assignArea = area;
    this.selectedCollectorId = '';
    this.api.get<{ data: { id: string; name: string; email: string }[] }>('/areas/collector-options').subscribe({
      next: (res) => {
        const assignedIds = new Set(area.collectors?.map((c) => String(c.userId)) || []);
        this.collectorOptions.set(res.data.filter((c) => !assignedIds.has(String(c.id))));
        this.assignModalOpen.set(true);
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal memuat opsi pengepul', type: 'error' });
      },
    });
  }

  assignCollector() {
    if (!this.assignArea || !this.selectedCollectorId) return;
    this.assigning.set(true);
    this.api.post(`/areas/${this.assignArea.id}/collectors`, { userId: this.selectedCollectorId }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignModalOpen.set(false);
        this.toast.set({ message: 'Pengepul berhasil ditugaskan ke area.', type: 'success' });
        this.load();
      },
      error: (err) => {
        this.assigning.set(false);
        this.toast.set({ message: err.message || 'Gagal menugaskan pengepul', type: 'error' });
      },
    });
  }

  removeCollector(area: Area, userId: string) {
    if (!confirm('Hapus penugasan pengepul ini dari area?')) return;
    this.api.delete(`/areas/${area.id}/collectors/${userId}`).subscribe({
      next: () => {
        this.toast.set({ message: 'Pengepul berhasil dilepas dari area.', type: 'success' });
        this.load();
      },
      error: (err) => {
        this.toast.set({ message: err.message || 'Gagal melepas pengepul', type: 'error' });
      },
    });
  }
}

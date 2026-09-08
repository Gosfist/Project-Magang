import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { MainCoreNode, PageMeta } from '../../../../shared/models/types';

type ParentOption = {
  id: string;
  name: string;
  type: string;
  redamanIn: number | null;
  rasioRedamanPorts: Record<string, string>;
  outputCount: number;
  usedPorts: number[];
};

const emptyOdcForm = {
  parentId: '',
  parentPortOut: '',
  namaTitik: '',
  redamanIn: '',
  jarakKabel: '',
  alamat: '',
  splitter: '1:2',
};

@Component({
  selector: 'app-odc',
  standalone: true,
  imports: [FormsModule, LucidePencil, LucidePlus, LucideSearch, LucideTrash2, ModalComponent, PaginationComponent, ToastComponent],
  templateUrl: './odc.component.html',
})
export class OdcComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  items = signal<MainCoreNode[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  page = signal(1);
  search = '';
  open = signal(false);
  editing = signal<MainCoreNode | null>(null);
  form = { ...emptyOdcForm };
  parentSearch = '';
  parentCategory = '';
  parents = signal<ParentOption[]>([]);
  parentDropdownOpen = signal(false);
  private chosenParent: ParentOption | undefined;
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private parentRequestId = 0;

  selectedParent(): ParentOption | undefined {
    return this.chosenParent?.id === this.form.parentId
      ? this.chosenParent
      : this.parents().find((parent) => parent.id === this.form.parentId);
  }

  selectSource(parent: ParentOption): void {
    this.chosenParent = parent;
    this.form.parentId = parent.id;
    this.onParentSelect();
    this.parentDropdownOpen.set(false);
  }

  onSourceFocusOut(event: FocusEvent, container: HTMLElement): void {
    if (!container.contains(event.relatedTarget as Node | null)) this.parentDropdownOpen.set(false);
  }

  availablePorts(): number[] {
    const parent = this.selectedParent();
    if (!parent) return [];
    return Array.from({ length: parent.outputCount ?? 0 }, (_, index) => index + 1).filter(
      (port) => !parent.usedPorts.includes(port) || String(port) === this.form.parentPortOut
    );
  }

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { if (this.debounceTimer) clearTimeout(this.debounceTimer); }

  load(): void {
    this.api.get<{ data: MainCoreNode[]; meta: PageMeta }>(`/main-core/odc?search=${encodeURIComponent(this.search)}&page=${this.page()}`).subscribe({
      next: (response) => { this.items.set(response.data); this.meta.set(response.meta); },
      error: (error) => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  fetchParents(): void {
    const requestId = ++this.parentRequestId;
    if (!this.parentCategory) {
      this.parents.set([]);
      return;
    }
    const editing = this.editing();
    const query = `/main-core/odc/parents?search=${encodeURIComponent(this.parentSearch)}${
      this.parentCategory ? `&category=${encodeURIComponent(this.parentCategory)}` : ''
    }${editing ? `&currentNodeId=${editing.id}&currentParentId=${editing.parentId ?? ''}` : ''}`;
    this.api.get<{ data: ParentOption[] }>(query).subscribe({
      next: (response) => {
        if (requestId === this.parentRequestId) {
          this.parents.set(response.data);
          const selected = response.data.find((parent) => parent.id === this.form.parentId);
          if (selected) this.chosenParent = selected;
        }
      },
      error: () => {
        if (requestId === this.parentRequestId) this.parents.set([]);
      },
    });
  }

  onParentSearchChange(): void {
    ++this.parentRequestId;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.fetchParents(), 250);
  }

  onParentCategoryChange(): void {
    this.parentDropdownOpen.set(false);
    this.chosenParent = undefined;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.parentSearch = '';
    this.form.parentId = '';
    this.parents.set([]);
    this.onParentSelect();
    this.fetchParents();
  }

  onParentSelect(): void { this.form.parentPortOut = ''; this.form.redamanIn = ''; }
  onPortSelect(): void { this.form.redamanIn = this.autoRedaman(); }
  onDistanceChange(): void { this.form.redamanIn = this.autoRedaman(); }

  autoRedaman(): string {
    const parent = this.selectedParent();
    if (!parent || this.form.jarakKabel === '') return this.form.redamanIn;
    const distance = Number(this.form.jarakKabel);
    let splitterLoss = 0;
    if (parent.type === 'rasio' && this.form.parentPortOut) {
      const percentage = Number((parent.rasioRedamanPorts[this.form.parentPortOut] ?? '').replace('%', '').replace(',', '.'));
      if (percentage > 0) splitterLoss = -10 * Math.log10(percentage / 100);
    } else if (parent.type !== 'server' && parent.outputCount) {
      splitterLoss = 10 * Math.log10(parent.outputCount);
    }
    return ((parent.redamanIn ?? 0) - splitterLoss - (distance / 1000) * 0.35 - 1).toFixed(2);
  }

  formatDate(date: string): string { return new Date(date).toLocaleDateString('id-ID'); }

  show(node?: MainCoreNode): void {
    this.parentDropdownOpen.set(false);
    this.chosenParent = undefined;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.editing.set(node ?? null);
    this.parentSearch = '';
    this.parentCategory = node?.parent?.tipeTitik ?? '';
    this.parents.set([]);
    this.form = node ? {
      parentId: node.parentId ?? '', parentPortOut: String(node.parentPortOut ?? ''), namaTitik: node.namaTitik,
      redamanIn: String(node.redamanIn ?? ''), jarakKabel: String(node.jarakKabel ?? ''), alamat: node.alamat ?? '',
      splitter: node.jenisSplitter ?? '1:2',
    } : { ...emptyOdcForm };
    this.open.set(true);
    this.fetchParents();
  }

  save(): void {
    if (!this.parentCategory || !this.form.parentId) {
      this.toast.set({ message: 'Pilih kategori dan sumber jalur terlebih dahulu.', type: 'error' });
      return;
    }
    const editing = this.editing();
    const body = {
      parentId: this.form.parentId || undefined,
      parentPortOut: this.form.parentPortOut ? Number(this.form.parentPortOut) : undefined,
      namaTitik: this.form.namaTitik,
      redamanIn: this.form.redamanIn === '' ? undefined : Number(this.form.redamanIn),
      jarakKabel: this.form.jarakKabel === '' ? undefined : Number(this.form.jarakKabel),
      alamat: this.form.alamat || undefined,
      spesifikasi: { jenis_splitter: this.form.splitter },
    };
    const request = editing ? this.api.patch<{ message: string }>(`/main-core/odc/${editing.id}`, body) : this.api.post<{ message: string }>('/main-core/odc', body);
    request.subscribe({ next: (response) => { this.open.set(false); this.toast.set({ message: response.message, type: 'success' }); this.load(); }, error: (error) => this.toast.set({ message: error.message, type: 'error' }) });
  }

  remove(node: MainCoreNode): void {
    if (!confirm(`Hapus ${node.namaTitik}?`)) return;
    this.api.delete<{ message: string }>(`/main-core/odc/${node.id}`).subscribe({ next: (response) => { this.toast.set({ message: response.message, type: 'success' }); this.load(); }, error: (error) => this.toast.set({ message: error.message, type: 'error' }) });
  }
}

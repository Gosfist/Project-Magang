import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { MainCoreNode, PageMeta } from '../../../shared/models/types';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

type ParentOption = {
  id: string;
  name: string;
  type: string;
  redamanIn: number | null;
  splitterRatio: string | null;
  rasioRedamanPorts: Record<string, string>;
  outputCount: number;
  usedPorts: number[];
};

const labels: Record<string, string> = {
  server: 'Server',
  rasio: 'Rasio',
  odc: 'ODC',
  odp: 'ODP',
};

const emptyForm = {
  parentId: '',
  parentPortOut: '',
  namaTitik: '',
  redamanIn: '',
  jarakKabel: '',
  alamat: '',
  splitter: '1:2',
  ratio1: '10%',
  ratio2: '90%',
};

@Component({
  selector: 'app-main-core',
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
  templateUrl: './main-core.component.html',
})
export class MainCoreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  type = signal<string>('server');
  items = signal<MainCoreNode[]>([]);
  meta = signal<PageMeta>({ currentPage: 1, lastPage: 1, perPage: 5, total: 0 });
  search = '';
  page = signal(1);

  open = signal(false);
  editing = signal<MainCoreNode | null>(null);
  form = { ...emptyForm };

  parentSearch = '';
  parentCategory = '';
  parents = signal<ParentOption[]>([]);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  private routeSub?: Subscription;
  private debounceTimer: any = null;

  currentLabel = computed(() => labels[this.type()] ?? 'Main Core');
  nameLabel = computed(() =>
    this.type() === 'server' ? 'Nama Core' : `Nama ${this.currentLabel()}`
  );

  selectedParent = computed(() => {
    return this.parents().find((p) => p.id === this.form.parentId);
  });

  availablePorts = computed(() => {
    const parent = this.selectedParent();
    if (!parent) return [];
    return Array.from({ length: parent.outputCount ?? 0 }, (_, i) => i + 1).filter(
      (p) => !parent.usedPorts.includes(p) || String(p) === this.form.parentPortOut
    );
  });

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const t = params['type'];
      if (!labels[t]) {
        this.router.navigate(['/dashboard/main-core/server']);
        return;
      }
      this.type.set(t);
      this.search = '';
      this.page.set(1);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('id-ID');
  }

  load(): void {
    const t = this.type();
    this.api
      .get<{ data: MainCoreNode[]; meta: PageMeta }>(
        `/main-core/${t}?search=${encodeURIComponent(this.search)}&page=${this.page()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.meta.set(r.meta);
        },
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }

  fetchParents(): void {
    const t = this.type();
    if (t === 'server') return;
    const editing = this.editing();
    const query = `/main-core/${t}/parents?search=${encodeURIComponent(this.parentSearch)}${
      this.parentCategory ? `&category=${encodeURIComponent(this.parentCategory)}` : ''
    }${editing ? `&currentNodeId=${editing.id}&currentParentId=${editing.parentId ?? ''}` : ''}`;

    this.api.get<{ data: ParentOption[] }>(query).subscribe({
      next: (r) => this.parents.set(r.data),
      error: () => this.parents.set([]),
    });
  }

  onParentSearchChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.fetchParents(), 250);
  }

  onParentSelect(): void {
    this.form.parentPortOut = '';
    this.form.redamanIn = '';
  }

  onPortSelect(): void {
    this.form.redamanIn = this.autoRedaman(this.form.jarakKabel, this.form.parentPortOut);
  }

  onDistanceChange(): void {
    this.form.redamanIn = this.autoRedaman(this.form.jarakKabel, this.form.parentPortOut);
  }

  autoRedaman(distanceValue: string, portValue: string): string {
    const t = this.type();
    const parent = this.selectedParent();
    if (t === 'server' || !parent || distanceValue === '') return this.form.redamanIn;

    const distance = Number(distanceValue);
    let splitterLoss = 0;
    if (parent.type === 'rasio' && portValue) {
      const raw = parent.rasioRedamanPorts[portValue] ?? '';
      const pct = Number(raw.replace('%', '').replace(',', '.'));
      if (pct > 0) splitterLoss = -10 * Math.log10(pct / 100);
    } else if (parent.type !== 'server' && parent.outputCount) {
      splitterLoss = 10 * Math.log10(parent.outputCount);
    }

    const connector = t === 'odp' && parent.type === 'odc' ? 1 : 0;
    const redaman =
      (parent.redamanIn ?? 0) - splitterLoss - (distance / 1000) * 0.35 - connector - 1;
    return redaman.toFixed(2);
  }

  show(node?: MainCoreNode): void {
    this.editing.set(node ?? null);
    this.parentSearch = '';
    this.parentCategory = node?.parent?.tipeTitik ?? '';
    this.parents.set([]);

    if (node) {
      this.form = {
        parentId: node.parentId ?? '',
        parentPortOut: String(node.parentPortOut ?? ''),
        namaTitik: node.namaTitik,
        redamanIn: String(node.redamanIn ?? ''),
        jarakKabel: String(node.jarakKabel ?? ''),
        alamat: node.alamat ?? '',
        splitter: node.jenisSplitter ?? '1:2',
        ratio1: node.rasioRedamanPorts?.['1'] ?? '10%',
        ratio2: node.rasioRedamanPorts?.['2'] ?? '90%',
      };
    } else {
      this.form = { ...emptyForm };
    }

    this.open.set(true);
    if (this.type() !== 'server') {
      this.fetchParents();
    }
  }

  save(): void {
    const t = this.type();
    const editing = this.editing();
    const body: Record<string, unknown> = {
      parentId: this.form.parentId || undefined,
      parentPortOut: this.form.parentPortOut ? Number(this.form.parentPortOut) : undefined,
      namaTitik: this.form.namaTitik,
      redamanIn: this.form.redamanIn === '' ? undefined : Number(this.form.redamanIn),
      jarakKabel: this.form.jarakKabel === '' ? undefined : Number(this.form.jarakKabel),
      alamat: this.form.alamat || undefined,
      spesifikasi:
        t === 'rasio'
          ? { rasio_redaman_ports: { '1': this.form.ratio1, '2': this.form.ratio2 } }
          : t === 'odc' || t === 'odp'
            ? { jenis_splitter: this.form.splitter }
            : undefined,
    };

    const req = editing
      ? this.api.patch<{ message: string }>(`/main-core/${t}/${editing.id}`, body)
      : this.api.post<{ message: string }>(`/main-core/${t}`, body);

    req.subscribe({
      next: (r) => {
        this.open.set(false);
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  remove(node: MainCoreNode): void {
    if (!confirm(`Hapus ${node.namaTitik}?`)) return;
    const t = this.type();
    this.api.delete<{ message: string }>(`/main-core/${t}/${node.id}`).subscribe({
      next: (r) => {
        this.toast.set({ message: r.message, type: 'success' });
        this.load();
      },
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }
}

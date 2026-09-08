import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowRight, LucideGitBranch, LucideSearch } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { MainCoreNode } from '../../../../shared/models/types';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type Option = { id: string; namaTitik: string; tipeTitik: string };

@Component({
  selector: 'app-trace',
  standalone: true,
  imports: [FormsModule, LucideArrowRight, LucideGitBranch, LucideSearch, ToastComponent],
  templateUrl: './trace.component.html',
})
export class TraceComponent implements OnInit {
  private api = inject(ApiService);

  options = signal<Option[]>([]);
  category = '';
  search = '';
  nodeId = '';
  result = signal<{
    selectedNode: MainCoreNode;
    paths: MainCoreNode[][];
    traceNodeCount: number;
  } | null>(null);

  toast = signal<{ message: string; type: 'error' } | null>(null);

  filteredOptions = computed(() => {
    const cat = this.category;
    const q = this.search.toLowerCase();
    return this.options().filter(
      (n) => n.tipeTitik === cat && n.namaTitik.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.api.get<{ data: Option[] }>('/main-core/options').subscribe({
      next: (r) => this.options.set(r.data),
      error: (e) => this.toast.set({ message: e.message, type: 'error' }),
    });
  }

  onCategoryChange(): void {
    this.search = '';
    this.nodeId = '';
  }

  onSearchChange(): void {
    const found = this.options().find(
      (n) => n.tipeTitik === this.category && n.namaTitik === this.search
    );
    this.nodeId = found?.id ?? '';
  }

  submit(): void {
    if (!this.nodeId) {
      this.toast.set({ message: 'Pilih nama dari daftar yang tersedia.', type: 'error' });
      return;
    }

    this.api
      .get<{
        selectedNode: MainCoreNode;
        paths: MainCoreNode[][];
        traceNodeCount: number;
      }>(`/main-core/trace?category=${this.category}&nodeId=${this.nodeId}`)
      .subscribe({
        next: (res) => this.result.set(res),
        error: (e) => this.toast.set({ message: e.message, type: 'error' }),
      });
  }
}

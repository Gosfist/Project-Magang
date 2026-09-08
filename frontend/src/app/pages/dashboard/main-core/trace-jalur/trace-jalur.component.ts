import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowRight, LucideGitBranch, LucideSearch } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { MainCoreNode } from '../../../../shared/models/types';

type TraceOption = { id: string; namaTitik: string; tipeTitik: string };

@Component({
  selector: 'app-trace-jalur',
  standalone: true,
  imports: [FormsModule, LucideArrowRight, LucideGitBranch, LucideSearch, ToastComponent],
  templateUrl: './trace-jalur.component.html',
})
export class TraceJalurComponent implements OnInit {
  private api = inject(ApiService);

  options = signal<TraceOption[]>([]);
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
    const query = this.search.toLowerCase();
    return this.options().filter(
      (node) => node.tipeTitik === this.category && node.namaTitik.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.api.get<{ data: TraceOption[] }>('/main-core/options').subscribe({
      next: (response) => this.options.set(response.data),
      error: (error) => this.toast.set({ message: error.message, type: 'error' }),
    });
  }

  onCategoryChange(): void {
    this.search = '';
    this.nodeId = '';
    this.result.set(null);
  }

  onSearchChange(): void {
    const selected = this.options().find(
      (node) => node.tipeTitik === this.category && node.namaTitik === this.search
    );
    this.nodeId = selected?.id ?? '';
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
        next: (response) => this.result.set(response),
        error: (error) => this.toast.set({ message: error.message, type: 'error' }),
      });
  }
}

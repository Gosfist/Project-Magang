import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../core/services/api.service';

type OutputPort = {
  port: number;
  destinations: { id: string; name: string; type: string }[];
  customers: { id: string; customerNumber: string; name: string; online: boolean | null }[];
};

@Component({
  selector: 'app-main-core-editor-tabs',
  standalone: true,
  templateUrl: './main-core-editor-tabs.component.html',
})
export class MainCoreEditorTabsComponent {
  @Input() nodeId: string | null = null;
  @Input() category = '';
  @Input() label = '';
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  tab = signal<'data' | 'output'>('data');
  ports = signal<OutputPort[]>([]);
  loading = signal(false);
  error = signal('');
  warnings = signal<string[]>([]);

  selectTab(tab: 'data' | 'output'): void {
    this.tab.set(tab);
    if (tab === 'output') this.load();
  }

  onTabKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'data' : event.key === 'End' ? 'output' : this.tab() === 'data' ? 'output' : 'data';
    const list = (event.currentTarget as HTMLElement).parentElement;
    this.selectTab(next);
    list?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  }

  load(): void {
    if (!this.nodeId || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.get<{ data: OutputPort[]; warnings: string[] }>(`/main-core/${this.category}/${this.nodeId}/output`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => { this.ports.set(response.data); this.warnings.set(response.warnings); this.loading.set(false); },
        error: () => { this.error.set('Output gagal dimuat. Silakan coba lagi.'); this.loading.set(false); },
      });
  }

  destinationType(type: string): string { return type === 'rasio' ? 'Rasio' : type.toUpperCase(); }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { LucideCheckCircle2, LucideClock3, LucideTrendingUp } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

type SalesRow = {
  id: string;
  name: string;
  phone?: string | null;
  status: 'active' | 'inactive';
  monthRegistrations: number;
  totalRegistrations: number;
};

type SalesSummaryResponse = {
  summary: {
    activeSales: number;
    inactiveSales: number;
    monthRegistrations: number;
  };
  data: SalesRow[];
};

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [LucideCheckCircle2, LucideClock3, LucideTrendingUp, ToastComponent],
  templateUrl: './sales.component.html',
})
export class SalesComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  summary = signal({ activeSales: 0, inactiveSales: 0, monthRegistrations: 0 });
  items = signal<SalesRow[]>([]);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<SalesSummaryResponse>('/users/sales-summary').subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.items.set(result.data);
        this.loading.set(false);
      },
      error: (error) => {
        this.toast.set({ message: error.message, type: 'error' });
        this.loading.set(false);
      },
    });
  }
}

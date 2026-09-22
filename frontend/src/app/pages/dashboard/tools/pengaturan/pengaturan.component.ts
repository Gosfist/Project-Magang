import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type BillingSettings = {
  billingStartDay: number;
  billingEndDay: number;
  billingTimezone: 'WIB' | 'WITA' | 'WIT';
  isolationCheckHour: number;
  psbPaymentMode: 'full' | 'prorate';
  psbFee: number;
};

@Component({
  selector: 'app-pengaturan',
  standalone: true,
  imports: [FormsModule, ToastComponent],
  templateUrl: './pengaturan.component.html',
})
export class PengaturanComponent implements OnInit {
  private readonly api = inject(ApiService);
  loading = signal(false);
  saving = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  form: BillingSettings = {
    billingStartDay: 1,
    billingEndDay: 10,
    billingTimezone: 'WIB',
    isolationCheckHour: 0,
    psbPaymentMode: 'full',
    psbFee: 0,
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<BillingSettings>('/settings/billing').subscribe({
      next: (data) => {
        this.form = data;
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.set({ message: error.message, type: 'error' });
      },
    });
  }

  save(): void {
    if (this.form.billingStartDay > this.form.billingEndDay) {
      this.toast.set({ message: 'Tanggal mulai pembayaran tidak boleh lebih besar dari tanggal akhir pembayaran.', type: 'error' });
      return;
    }
    this.saving.set(true);
    this.api.patch<{ message: string; data: BillingSettings }>('/settings/billing', this.form).subscribe({
      next: (result) => {
        this.form = result.data;
        this.saving.set(false);
        this.toast.set({ message: result.message, type: 'success' });
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.set({ message: error.message, type: 'error' });
      },
    });
  }
}

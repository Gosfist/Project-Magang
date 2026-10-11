import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
@Component({
  selector: 'app-finance-salary', standalone: true, imports: [FormsModule],
  templateUrl: './finance-salary.component.html',
})
export class FinanceSalaryComponent implements OnInit {
  private api = inject(ApiService);
  loading = signal(true); loaded = signal(false); saving = signal(false); error = signal(''); message = signal('');
  rates = { psb: 0, sales: 0 };
  ngOnInit() {
    this.api.get<typeof this.rates>('/finance/salary').subscribe({
      next: data => { this.rates = data; this.loaded.set(true); this.loading.set(false); },
      error: err => { this.error.set(err.message); this.loading.set(false); },
    });
  }
  save() {
    this.error.set(''); this.message.set('');
    if (!this.loaded() || this.saving()) return;
    if (![this.rates.psb, this.rates.sales].every(value => Number.isInteger(value) && value >= 0 && value <= 1000000000)) {
      this.error.set('Nominal gaji harus bilangan bulat antara 0 dan 1.000.000.000.'); return;
    }
    this.saving.set(true);
    this.api.patch<{ message: string }>('/finance/salary', this.rates).subscribe({
      next: result => { this.message.set(result.message); this.saving.set(false); },
      error: err => { this.error.set(err.message); this.saving.set(false); },
    });
  }
}

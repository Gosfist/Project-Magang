import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type TemplateData = {
  enabled: boolean;
  registration: string;
};

@Component({
  selector: 'app-bot-wa-template',
  standalone: true,
  imports: [FormsModule, ToastComponent],
  templateUrl: './bot-wa-template.component.html',
})
export class BotWaTemplateComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.botWaUrl;

  loading = signal(false);
  saving = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  form: TemplateData = {
    enabled: false,
    registration: '',
  };

  readonly placeholders = [
    { key: '{nama}', desc: 'Nama pelanggan' },
    { key: '{nomor_pelanggan}', desc: 'Nomor pelanggan (6 digit)' },
    { key: '{paket}', desc: 'Nama paket layanan' },
    { key: '{username}', desc: 'Username PPPoE' },
    { key: '{password}', desc: 'Password PPPoE' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<TemplateData>(`${this.baseUrl}/templates`).subscribe({
      next: (data) => {
        this.form = data;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.set({ message: 'Gagal memuat template. Pastikan Bot WhatsApp berjalan.', type: 'error' });
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.http.patch<{ message: string; data: TemplateData }>(`${this.baseUrl}/templates`, this.form).subscribe({
      next: (result) => {
        this.form = result.data;
        this.saving.set(false);
        this.toast.set({ message: result.message, type: 'success' });
      },
      error: () => {
        this.saving.set(false);
        this.toast.set({ message: 'Gagal menyimpan template.', type: 'error' });
      },
    });
  }

  get preview(): string {
    return this.form.registration
      .replace(/\{nama\}/g, 'Ahmad Fauzi')
      .replace(/\{nomor_pelanggan\}/g, '000123')
      .replace(/\{paket\}/g, 'Paket 20 Mbps')
      .replace(/\{username\}/g, 'ahmad.fauzi')
      .replace(/\{password\}/g, 'p@ssw0rd');
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

export interface TemplateConfig {
  id: string;
  name: string;
  title: string;
  label: string;
  description: string;
  placeholders: { key: string; desc: string }[];
  sampleData: Record<string, string>;
}

export const TEMPLATE_LIST: TemplateConfig[] = [
  {
    id: 'registration',
    name: 'Add Pelanggan',
    title: 'Template Registrasi Pelanggan Baru',
    label: 'Pesan Registrasi Pelanggan Baru',
    description: 'Pesan otomatis yang dikirim saat akun pelanggan baru berhasil didaftarkan di sistem.',
    placeholders: [
      { key: '{nama}', desc: 'Nama lengkap pelanggan' },
      { key: '{nomor_pelanggan}', desc: 'Nomor pelanggan (6 digit)' },
      { key: '{paket}', desc: 'Nama paket layanan internet' },
      { key: '{username}', desc: 'Username akun PPPoE' },
      { key: '{password}', desc: 'Password akun PPPoE' },
    ],
    sampleData: {
      '{nama}': 'Ahmad Fauzi',
      '{nomor_pelanggan}': '000123',
      '{paket}': 'Paket 20 Mbps',
      '{username}': 'ahmad.fauzi',
      '{password}': 'p@ssw0rd',
    },
  },
  {
    id: 'isolation',
    name: 'Isolir',
    title: 'Template Pemberitahuan Isolir Pelanggan',
    label: 'Pesan Pemberitahuan Isolir',
    description: 'Pesan otomatis yang dikirim saat layanan internet pelanggan dinonaktifkan sementara (isolir) karena tagihan.',
    placeholders: [
      { key: '{nama}', desc: 'Nama lengkap pelanggan' },
      { key: '{nomor_pelanggan}', desc: 'Nomor pelanggan (6 digit)' },
      { key: '{paket}', desc: 'Nama paket layanan internet' },
      { key: '{total_tagihan}', desc: 'Total tagihan yang harus dibayar' },
      { key: '{jatuh_tempo}', desc: 'Batas tanggal pembayaran tagihan' },
    ],
    sampleData: {
      '{nama}': 'Ahmad Fauzi',
      '{nomor_pelanggan}': '000123',
      '{paket}': 'Paket 20 Mbps',
      '{total_tagihan}': 'Rp 165.000',
      '{jatuh_tempo}': '20 September 2026',
    },
  },
];

@Component({
  selector: 'app-bot-wa-template',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './bot-wa-template.component.html',
})
export class BotWaTemplateComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.botWaUrl;

  readonly templateList = TEMPLATE_LIST;
  activeId = signal<string>('registration');

  loading = signal(false);
  saving = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  templatesData: Record<string, string> = {
    registration: '',
    isolation: '',
  };

  currentTemplate = computed(() => {
    return this.templateList.find((t) => t.id === this.activeId()) || this.templateList[0];
  });

  get preview(): string {
    const current = this.currentTemplate();
    let text = this.templatesData[this.activeId()] || '';
    if (!current) return text;
    for (const [key, val] of Object.entries(current.sampleData)) {
      text = text.replaceAll(key, val);
    }
    return text;
  }

  get formattedPreview(): string {
    let text = this.preview;
    // Escape HTML
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // WhatsApp Markdown Bold: *text*
    text = text.replace(/\*([^*\n]+)\*/g, '<strong class="font-bold text-white">$1</strong>');
    // WhatsApp Markdown Italic: _text_
    text = text.replace(/_([^_\\n]+)_/g, '<em class="italic text-emerald-100">$1</em>');
    // WhatsApp Markdown Strike: ~text~
    text = text.replace(/~([^~\\n]+)~/g, '<del class="line-through opacity-75">$1</del>');
    return text;
  }

  insertVariable(key: string): void {
    const activeId = this.activeId();
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[name="tpl_${activeId}"]`);
    if (!textarea) {
      this.templatesData[activeId] = (this.templatesData[activeId] || '') + key;
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const currentVal = this.templatesData[activeId] || '';
    const newVal = currentVal.substring(0, start) + key + currentVal.substring(end);
    this.templatesData[activeId] = newVal;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  }

  ngOnInit(): void {
    this.load();
  }

  selectTemplate(id: string): void {
    this.activeId.set(id);
  }

  load(): void {
    this.loading.set(true);
    this.http.get<Record<string, any>>(`${this.baseUrl}/templates`).subscribe({
      next: (data) => {
        for (const tpl of this.templateList) {
          if (typeof data[tpl.id] === 'string') {
            this.templatesData[tpl.id] = data[tpl.id];
          }
        }
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
    this.http.patch<{ message: string; data: Record<string, any> }>(`${this.baseUrl}/templates`, this.templatesData).subscribe({
      next: (result) => {
        if (result.data) {
          for (const tpl of this.templateList) {
            if (typeof result.data[tpl.id] === 'string') {
              this.templatesData[tpl.id] = result.data[tpl.id];
            }
          }
        }
        this.saving.set(false);
        this.toast.set({ message: result.message || 'Template berhasil disimpan.', type: 'success' });
      },
      error: () => {
        this.saving.set(false);
        this.toast.set({ message: 'Gagal menyimpan template.', type: 'error' });
      },
    });
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

export interface WaLogItem {
  id: number;
  target: string;
  text: string;
  status: 'berhasil' | 'gagal' | string;
  errorMessage?: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-bot-wa-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ToastComponent],
  templateUrl: './bot-wa-logs.component.html',
})
export class BotWaLogsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.botWaUrl;

  logs = signal<WaLogItem[]>([]);
  loading = signal(false);
  clearing = signal(false);
  searchQuery = signal('');
  selectedLog = signal<WaLogItem | null>(null);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  totalCount = computed(() => this.logs().length);
  successCount = computed(() => this.logs().filter((l) => l.status === 'berhasil').length);
  failedCount = computed(() => this.logs().filter((l) => l.status === 'gagal').length);

  filteredLogs = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.logs();
    return this.logs().filter(
      (log) =>
        log.target.toLowerCase().includes(q) ||
        log.text.toLowerCase().includes(q) ||
        (log.errorMessage && log.errorMessage.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.http.get<{ logs: WaLogItem[]; total: number }>(`${this.baseUrl}/logs`).subscribe({
      next: (res) => {
        this.logs.set(res.logs || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.set({
          message: 'Gagal memuat log notifikasi. Pastikan Bot WhatsApp berjalan.',
          type: 'error',
        });
      },
    });
  }

  clearLogs(): void {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh riwayat log notifikasi WhatsApp?')) return;
    this.clearing.set(true);
    this.http.delete<{ message: string }>(`${this.baseUrl}/logs`).subscribe({
      next: (res) => {
        this.logs.set([]);
        this.clearing.set(false);
        this.toast.set({ message: res.message || 'Semua log berhasil dibersihkan.', type: 'success' });
      },
      error: () => {
        this.clearing.set(false);
        this.toast.set({ message: 'Gagal membersihkan log.', type: 'error' });
      },
    });
  }

  deleteSingleLog(id: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!confirm('Hapus log pesan ini?')) return;
    this.http.delete<{ message: string }>(`${this.baseUrl}/logs/${id}`).subscribe({
      next: () => {
        this.logs.update((items) => items.filter((item) => item.id !== id));
        if (this.selectedLog()?.id === id) this.selectedLog.set(null);
        this.toast.set({ message: 'Log berhasil dihapus.', type: 'success' });
      },
      error: () => {
        this.toast.set({ message: 'Gagal menghapus log.', type: 'error' });
      },
    });
  }

  openDetail(log: WaLogItem): void {
    this.selectedLog.set(log);
  }

  closeDetail(): void {
    this.selectedLog.set(null);
  }

  formatPhone(phone: string): string {
    if (!phone) return '-';
    // Format nice phone display
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('62') && clean.length >= 10) {
      return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    if (clean.startsWith('0') && clean.length >= 10) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return phone;
  }
}

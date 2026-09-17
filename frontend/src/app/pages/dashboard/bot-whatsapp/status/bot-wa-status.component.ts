import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type WaStatus = {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrAvailable: boolean;
  message: string;
};

@Component({
  selector: 'app-bot-wa-status',
  standalone: true,
  imports: [ToastComponent],
  templateUrl: './bot-wa-status.component.html',
})
export class BotWaStatusComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.botWaUrl;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  waStatus = signal<WaStatus>({ status: 'disconnected', qrAvailable: false, message: '' });
  qrImage = signal<string | null>(null);
  loading = signal(false);
  actionLoading = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.fetchStatus();
    this.pollTimer = setInterval(() => this.fetchStatus(), 3000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  fetchStatus(): void {
    this.http.get<WaStatus>(`${this.baseUrl}/status`).subscribe({
      next: (data) => {
        this.waStatus.set(data);
        if (data.qrAvailable) {
          this.fetchQR();
        } else {
          this.qrImage.set(null);
        }
      },
      error: () => {
        this.waStatus.set({ status: 'disconnected', qrAvailable: false, message: 'Bot WhatsApp tidak dapat dihubungi.' });
        this.qrImage.set(null);
      },
    });
  }

  fetchQR(): void {
    this.http.get<{ qr: string }>(`${this.baseUrl}/qr`).subscribe({
      next: (data) => this.qrImage.set(data.qr),
      error: () => this.qrImage.set(null),
    });
  }

  connect(): void {
    this.actionLoading.set(true);
    this.http.post<{ message: string }>(`${this.baseUrl}/connect`, {}).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.toast.set({ message: res.message, type: 'success' });
        this.fetchStatus();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.set({ message: 'Gagal menghubungkan WhatsApp.', type: 'error' });
      },
    });
  }

  restart(): void {
    this.actionLoading.set(true);
    this.http.post<{ message: string }>(`${this.baseUrl}/restart`, {}).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.toast.set({ message: res.message, type: 'success' });
        this.fetchStatus();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.set({ message: 'Gagal menghubungkan ulang.', type: 'error' });
      },
    });
  }

  disconnect(): void {
    this.actionLoading.set(true);
    this.http.post<{ message: string }>(`${this.baseUrl}/logout`, {}).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.toast.set({ message: res.message, type: 'success' });
        this.fetchStatus();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.set({ message: 'Gagal memutuskan koneksi.', type: 'error' });
      },
    });
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      connected: 'Terhubung',
      qr_ready: 'Menunggu Scan QR',
      connecting: 'Menghubungkan...',
      disconnected: 'Terputus',
    };
    return map[this.waStatus().status] || 'Tidak Diketahui';
  }

  get statusColor(): string {
    const map: Record<string, string> = {
      connected: 'bg-green-100 text-green-700',
      qr_ready: 'bg-yellow-100 text-yellow-700',
      connecting: 'bg-blue-100 text-blue-700',
      disconnected: 'bg-red-100 text-red-700',
    };
    return map[this.waStatus().status] || 'bg-slate-100 text-slate-600';
  }
}

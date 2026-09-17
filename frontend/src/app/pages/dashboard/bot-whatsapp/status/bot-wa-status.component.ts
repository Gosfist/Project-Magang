import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';

type WaStatus = {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrAvailable: boolean;
  message: string;
  botNumber?: string | null;
  connectedAt?: number | null;
  uptime?: number;
};

@Component({
  selector: 'app-bot-wa-status',
  standalone: true,
  imports: [FormsModule, ToastComponent],
  templateUrl: './bot-wa-status.component.html',
})
export class BotWaStatusComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.botWaUrl;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  waStatus = signal<WaStatus>({ status: 'disconnected', qrAvailable: false, message: '' });
  qrImage = signal<string | null>(null);
  countdown = signal(3);
  uptime = signal<number>(0);
  loading = signal(false);
  actionLoading = signal(false);
  pingLoading = signal(false);
  targetPhone = signal('');
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

  ngOnInit(): void {
    this.fetchStatus();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.pollTimer = setInterval(() => {
      if (this.waStatus().status === 'connected') {
        this.uptime.update((u) => u + 1);
      }

      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(3);
        this.fetchStatus();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  fetchStatus(): void {
    this.http.get<WaStatus>(`${this.baseUrl}/status`).subscribe({
      next: (data) => {
        this.waStatus.set(data);
        if (typeof data.uptime === 'number') {
          this.uptime.set(data.uptime);
        }
        if (data.qrAvailable) {
          this.fetchQR();
        } else {
          this.qrImage.set(null);
        }
      },
      error: () => {
        this.waStatus.set({ status: 'disconnected', qrAvailable: false, message: 'Bot WhatsApp tidak dapat dihubungi.' });
        this.qrImage.set(null);
        this.uptime.set(0);
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
        this.countdown.set(3);
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
        this.countdown.set(3);
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
        this.countdown.set(3);
        this.fetchStatus();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.set({ message: 'Gagal memutuskan koneksi.', type: 'error' });
      },
    });
  }

  sendPing(): void {
    const phone = this.targetPhone().trim();
    if (!phone) {
      this.toast.set({ message: 'Nomor target harus diisi.', type: 'error' });
      return;
    }

    this.pingLoading.set(true);
    this.http.post<{ message: string }>(`${this.baseUrl}/ping`, { phone }).subscribe({
      next: (res) => {
        this.pingLoading.set(false);
        this.toast.set({ message: res.message || 'Pesan Ping berhasil dikirim!', type: 'success' });
      },
      error: (err) => {
        this.pingLoading.set(false);
        const errMsg = err?.error?.message || 'Gagal mengirim pesan Ping.';
        this.toast.set({ message: errMsg, type: 'error' });
      },
    });
  }

  get formattedBotNumber(): string {
    const num = this.waStatus().botNumber;
    if (!num) return '-';
    return num.startsWith('62') ? `+${num}` : num;
  }

  get formattedUptime(): string {
    const totalSeconds = this.uptime();
    if (!totalSeconds || totalSeconds <= 0) return '0 detik';

    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts: string[] = [];
    if (d > 0) parts.push(`${d} hari`);
    if (h > 0) parts.push(`${h} jam`);
    if (m > 0) parts.push(`${m} menit`);
    parts.push(`${s} detik`);
    return parts.join(' ');
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

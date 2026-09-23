import { Component, DestroyRef, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideClock3, LucideMenu } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LucideClock3, LucideMenu],
  host: { class: 'sticky top-0 z-30 block' },
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly openSidebar = output<void>();
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private timerId: ReturnType<typeof setInterval> | null = null;
  private serverOffsetMs = 0;
  private lastServerSyncAt = 0;
  dateTime = signal('');
  compactDate = signal('');
  time = signal('');

  private readonly titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/monitoring/server': 'Monitoring Server',
    '/dashboard/monitoring/router': 'Monitoring NAS / Router',
    '/dashboard/monitoring/radius': 'Monitoring FreeRADIUS',
    '/dashboard/users': 'Data Petugas',
    '/dashboard/sales': 'Sales',
    '/dashboard/registrasi-pelanggan': 'Registrasi Pelanggan',
    '/dashboard/pasang-baru': 'Pasang Baru',
    '/dashboard/mainCore/traceJalur': 'Telusuri Jalur',
    '/dashboard/mainCore/server': 'Server',
    '/dashboard/mainCore/rasio': 'Rasio',
    '/dashboard/mainCore/odc': 'ODC',
    '/dashboard/mainCore/odp': 'ODP',
    '/dashboard/pppoe/harga-paket': 'Harga Paket',
    '/dashboard/pppoe/paket-layanan': 'Harga Paket',
    '/dashboard/pppoe/data-pelanggan': 'Data Pelanggan',
    '/dashboard/teknisi/data-pelanggan': 'Data Pelanggan',
    '/dashboard/pppoe/ip-pools': 'IP Pool',
    '/dashboard/router/routers': 'Router / NAS',
    '/dashboard/router/vpn-server': 'Server VPN',
    '/dashboard/router/vpn-client': 'Klien VPN',
    '/dashboard/bot-whatsapp/status': 'Login Bot Wa',
    '/dashboard/bot-whatsapp/template': 'Template Pesan WhatsApp',
    '/dashboard/bot-whatsapp/logs': 'Log Notifikasi Bot WhatsApp',
    '/dashboard/tools/kalkulator-redaman': 'Kalkulator Redaman',
    '/dashboard/pengaturan': 'Pengaturan',
    '/dashboard/finance/ringkasan': 'Ringkasan Keuangan',
    '/dashboard/finance/transaksi': 'Transaksi Keuangan',
    '/dashboard/finance/setoran': 'Setoran Kolektor',
    '/dashboard/finance/tagihan': 'Tagihan',
    '/dashboard/kolektor/tagihan': 'Tagihan',
    '/dashboard/kolektor/titipan': 'Titipan',
    '/dashboard/area': 'Data Area',
  };

  title = signal('Dashboard');

  ngOnInit(): void {
    const url = this.router.url;

    this.updateTitle(url);
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateTitle(this.router.url);
    });

    this.updateDateTime();
    this.timerId = setInterval(() => this.updateDateTime(), 1000);
    this.syncServerTime();
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  private updateTitle(url: string): void {
    this.title.set(this.titles[url] ?? 'Dashboard');
  }

  private updateDateTime(): void {
    if (Date.now() - this.lastServerSyncAt > 30_000) this.syncServerTime();
    const now = new Date(Date.now() + this.serverOffsetMs);
    const date = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    const time = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(now)
      .replaceAll('.', ':');
    const label = `${date.charAt(0).toUpperCase()}${date.slice(1)} ${time}`;
    this.dateTime.set(label);
    this.compactDate.set(new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(now));
    this.time.set(time);
  }

  private syncServerTime(): void {
    this.lastServerSyncAt = Date.now();
    this.api.get<{ now: string }>('/auth/time').subscribe({
      next: ({ now }) => {
        const serverTime = Date.parse(now);
        if (!Number.isNaN(serverTime)) this.serverOffsetMs = serverTime - Date.now();
        this.updateDateTime();
      },
      error: () => {},
    });
  }
}

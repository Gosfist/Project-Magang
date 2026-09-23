import { Component, DestroyRef, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideClock3, LucideMenu } from '@lucide/angular';

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
  private timerId: ReturnType<typeof setInterval> | null = null;
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
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  private updateTitle(url: string): void {
    this.title.set(this.titles[url] ?? 'Dashboard');
  }

  private updateDateTime(): void {
    const now = new Date();
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
}

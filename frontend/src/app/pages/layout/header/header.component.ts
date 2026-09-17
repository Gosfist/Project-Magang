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
    '/dashboard': 'Dasbor',
    '/dashboard/monitoring/server': 'Monitoring Server',
    '/dashboard/monitoring/router': 'Monitoring NAS / Router',
    '/dashboard/users': 'Data Petugas',
    '/dashboard/mainCore/traceJalur': 'Telusuri Jalur',
    '/dashboard/mainCore/server': 'Server',
    '/dashboard/mainCore/rasio': 'Rasio',
    '/dashboard/mainCore/odc': 'ODC',
    '/dashboard/mainCore/odp': 'ODP',
    '/dashboard/pppoe/paket-layanan': 'Daftar Paket PPPoE',
    '/dashboard/pppoe/data-pelanggan': 'Data Pelanggan',
    '/dashboard/pppoe/ip-pools': 'IP Pool',
    '/dashboard/bot-whatsapp/status': 'Login Bot Wa',
    '/dashboard/bot-whatsapp/template': 'Template Pesan WhatsApp',
    '/dashboard/tools/kalkulator-redaman': 'Kalkulator Redaman',
    '/dashboard/tools/pengaturan': 'Pengaturan',
  };

  title = signal('Dasbor');

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
    this.title.set(this.titles[url] ?? url.split('/').pop()?.toUpperCase() ?? 'Dasbor');
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

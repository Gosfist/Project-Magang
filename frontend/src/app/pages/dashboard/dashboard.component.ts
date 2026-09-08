import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalculator,
  LucideChevronDown,
  LucideClock3,
  LucideGitBranch,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMenu,
  LucideNetwork,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideCalculator,
    LucideChevronDown,
    LucideClock3,
    LucideGitBranch,
    LucideLayoutDashboard,
    LucideLogOut,
    LucideMenu,
    LucideNetwork,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private timerId: ReturnType<typeof setInterval> | null = null;

  // Sidebar state
  mobile = signal(false);
  coreOpen = signal(false);
  pppoeOpen = signal(false);
  toolOpen = signal(false);

  // DateTime
  dateTime = signal('');

  // Navigation links
  readonly coreLinks = [
    ['Trace Jalur', '/dashboard/main-core/trace'],
    ['Server', '/dashboard/main-core/server'],
    ['Rasio', '/dashboard/main-core/rasio'],
    ['ODC', '/dashboard/main-core/odc'],
    ['ODP', '/dashboard/main-core/odp'],
  ];
  readonly pppoeLinks = [
    ['Daftar Paket', '/dashboard/pppoe/packages'],
    ['Akun PPPoE', '/dashboard/pppoe/accounts'],
  ];

  private readonly titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/users': 'Data Petugas',
    '/dashboard/main-core/trace': 'Trace Jalur',
    '/dashboard/main-core/server': 'Server',
    '/dashboard/main-core/rasio': 'Rasio',
    '/dashboard/main-core/odc': 'ODC',
    '/dashboard/main-core/odp': 'ODP',
    '/dashboard/pppoe/packages': 'Daftar Paket PPPoE',
    '/dashboard/pppoe/accounts': 'Akun PPPoE',
    '/dashboard/tools/attenuation-calculator': 'Kalkulator Redaman',
  };

  title = signal('Dashboard');

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('/main-core')) this.coreOpen.set(true);
    if (url.includes('/pppoe')) this.pppoeOpen.set(true);
    if (url.includes('/tools')) this.toolOpen.set(true);

    this.updateTitle(url);
    this.router.events.subscribe(() => {
      this.updateTitle(this.router.url);
    });

    this.updateDateTime();
    this.timerId = setInterval(() => this.updateDateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  private updateTitle(url: string): void {
    this.title.set(this.titles[url] ?? url.split('/').pop()?.toUpperCase() ?? 'Dashboard');
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
  }
}

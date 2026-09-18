import { Component, inject, model, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideCalculator,
  LucideChevronDown,
  LucideGitBranch,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideNetwork,
  LucideRouter,
  LucideUsers,
  LucideX,
  LucideMessageCircle,
  LucideDollarSign,
  LucideMapPin,
} from '@lucide/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideCalculator,
    LucideChevronDown,
    LucideGitBranch,
    LucideLayoutDashboard,
    LucideLogOut,
    LucideNetwork,
    LucideRouter,
    LucideUsers,
    LucideX,
    LucideMessageCircle,
    LucideDollarSign,
    LucideMapPin,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent implements OnInit {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  // Sidebar state
  mobile = model(false);
  coreOpen = signal(false);
  routerOpen = signal(false);
  pppoeOpen = signal(false);
  toolOpen = signal(false);
  monitoringOpen = signal(false);
  botWaOpen = signal(false);
  financeOpen = signal(false);

  // Navigation links
  readonly coreLinks = [
    ['Telusuri Jalur', '/dashboard/mainCore/traceJalur'],
    ['Server', '/dashboard/mainCore/server'],
    ['Rasio', '/dashboard/mainCore/rasio'],
    ['ODC', '/dashboard/mainCore/odc'],
    ['ODP', '/dashboard/mainCore/odp'],
  ];
  readonly routerLinks = [
    ['Router / NAS', '/dashboard/router/routers'],
    ['Server VPN', '/dashboard/router/vpn-server'],
    ['Klien VPN', '/dashboard/router/vpn-client'],
  ];
  readonly pppoeLinks = [
    ['Data Pelanggan', '/dashboard/pppoe/data-pelanggan'],
    ['Paket Layanan', '/dashboard/pppoe/paket-layanan'],
    ['IP Pool', '/dashboard/pppoe/ip-pools'],
  ];
  readonly botWaLinks = [
    ['Login Bot Wa', '/dashboard/bot-whatsapp/status'],
    ['Template Pesan', '/dashboard/bot-whatsapp/template'],
    ['Log Notifikasi', '/dashboard/bot-whatsapp/logs']
  ];
  readonly financeLinks = [
    ['Ringkasan', '/dashboard/finance/ringkasan'],
    ['Transaksi', '/dashboard/finance/transaksi'],
    ['Setoran Pengepul', '/dashboard/finance/setoran'],
  ];

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('/mainCore')) this.coreOpen.set(true);
    if (url.includes('/router')) this.routerOpen.set(true);
    if (url.includes('/pppoe')) this.pppoeOpen.set(true);
    if (url.includes('/monitoring')) this.monitoringOpen.set(true);
    if (url.includes('/tools')) this.toolOpen.set(true);
    if (url.includes('/bot-whatsapp')) this.botWaOpen.set(true);
    if (url.includes('/finance')) this.financeOpen.set(true);
  }
}

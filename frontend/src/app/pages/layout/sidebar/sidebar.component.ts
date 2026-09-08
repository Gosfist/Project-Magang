import { Component, inject, model, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideCalculator,
  LucideChevronDown,
  LucideGitBranch,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideNetwork,
  LucideUsers,
  LucideX,
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
    LucideUsers,
    LucideX,
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
  pppoeOpen = signal(false);
  toolOpen = signal(false);
  monitoringOpen = signal(false);

  // Navigation links
  readonly coreLinks = [
    ['Trace Jalur', '/dashboard/mainCore/traceJalur'],
    ['Server', '/dashboard/mainCore/server'],
    ['Rasio', '/dashboard/mainCore/rasio'],
    ['ODC', '/dashboard/mainCore/odc'],
    ['ODP', '/dashboard/mainCore/odp'],
  ];
  readonly pppoeLinks = [
    ['Daftar Paket', '/dashboard/pppoe/packages'],
    ['Akun PPPoE', '/dashboard/pppoe/accounts'],
  ];

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('/mainCore')) this.coreOpen.set(true);
    if (url.includes('/pppoe')) this.pppoeOpen.set(true);
    if (url.includes('/monitoring')) this.monitoringOpen.set(true);
    if (url.includes('/tools')) this.toolOpen.set(true);
  }
}

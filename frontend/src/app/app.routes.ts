import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard/home/home.component').then(m => m.HomeComponent) },
      ...['finance', 'sales', 'kolektor', 'teknisi'].map(role => ({
        path: `${role}/dashboard`, loadComponent: () => import('./pages/dashboard/home/home.component').then(m => m.HomeComponent), canActivate: [roleGuard(role)],
      })),
      {
        path: 'monitoring/server',
        loadComponent: () =>
          import('./pages/dashboard/monitoring/server/server.component').then(
            (m) => m.ServerMonitoringComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'monitoring/router',
        loadComponent: () =>
          import('./pages/dashboard/monitoring/router/router-monitoring.component').then(
            (m) => m.RouterMonitoringComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'monitoring/radius',
        loadComponent: () =>
          import('./pages/dashboard/monitoring/radius/radius-monitoring.component').then(
            (m) => m.RadiusMonitoringComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      { path: 'users', loadComponent: () => import('./pages/dashboard/users/users.component').then(m => m.UsersComponent), canActivate: [adminGuard] },
      {
        path: 'sales', redirectTo: 'sales/dashboard', pathMatch: 'full',
      },
      {
        path: 'mainCore',
        canActivate: [roleGuard('admin', 'teknisi')],
        canActivateChild: [roleGuard('admin', 'teknisi')],
        children: [
          { path: '', redirectTo: 'traceJalur', pathMatch: 'full' },
          {
            path: 'traceJalur',
            loadComponent: () =>
              import('./pages/dashboard/main-core/trace-jalur/trace-jalur.component').then(
                (component) => component.TraceJalurComponent,
              ),
          },
          {
            path: 'server',
            loadComponent: () =>
              import('./pages/dashboard/main-core/server/server.component').then(
                (component) => component.ServerComponent,
              ),
          },
          {
            path: 'rasio',
            loadComponent: () =>
              import('./pages/dashboard/main-core/rasio/rasio.component').then(
                (component) => component.RasioComponent,
              ),
          },
          {
            path: 'odc',
            loadComponent: () =>
              import('./pages/dashboard/main-core/odc/odc.component').then(
                (component) => component.OdcComponent,
              ),
          },
          {
            path: 'odp',
            loadComponent: () =>
              import('./pages/dashboard/main-core/odp/odp.component').then(
                (component) => component.OdpComponent,
              ),
          },
        ],
      },
      {
        path: 'pppoe/harga-paket',
        loadComponent: () => import('./pages/dashboard/pppoe/paket-layanan/paket-layanan.component').then(m => m.PaketLayananComponent),
        canActivate: [roleGuard('admin')],
      },
      { path: 'pppoe/paket-layanan', redirectTo: 'pppoe/harga-paket', pathMatch: 'full' },
      {
        path: 'pppoe/data-pelanggan',
        loadComponent: () => import('./pages/dashboard/pppoe/data-pelanggan/data-pelanggan.component').then(m => m.DataPelangganComponent),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'teknisi/data-pelanggan',
        loadComponent: () => import('./pages/dashboard/pppoe/data-pelanggan/data-pelanggan.component').then(m => m.DataPelangganComponent),
        canActivate: [roleGuard('teknisi')],
      },
      {
        path: 'pppoe/ip-pools',
        loadComponent: () =>
          import('./pages/dashboard/pppoe/ip-pools/ip-pools.component').then(
            (m) => m.IpPoolsComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'router/routers',
        loadComponent: () =>
          import('./pages/dashboard/router/routers/routers.component').then(
            (m) => m.RoutersComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      { path: 'router/firewall', loadComponent: () => import('./pages/dashboard/router/firewall/firewall.component').then(m => m.FirewallComponent), canActivate: [roleGuard('admin')] },
      { path: 'pppoe/isolation', loadComponent: () => import('./pages/dashboard/pppoe/isolation/isolation.component').then(m => m.IsolationComponent), canActivate: [roleGuard('admin')] },
      {
        path: 'router/vpn-server',
        loadComponent: () =>
          import('./pages/dashboard/router/vpn-server/vpn-server.component').then(
            (m) => m.VpnServerComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'router/vpn-client',
        loadComponent: () =>
          import('./pages/dashboard/router/vpn-client/vpn-client.component').then(
            (m) => m.VpnClientComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'tools/kalkulator-redaman',
        loadComponent: () => import('./pages/dashboard/tools/kalkulator-redaman/kalkulator-redaman.component').then(m => m.KalkulatorRedamanComponent),
        canActivate: [roleGuard('admin', 'teknisi')],
      },
      {
        path: 'registrasi-pelanggan',
        loadComponent: () =>
          import('./pages/dashboard/psb/psb.component').then(
            (m) => m.PsbComponent,
          ),
        canActivate: [roleGuard('sales')],
      },
      {
        path: 'pasang-baru',
        loadComponent: () =>
          import('./pages/dashboard/psb/psb.component').then(
            (m) => m.PsbComponent,
          ),
        canActivate: [roleGuard('teknisi')],
      },
      {
        path: 'kolektor/tagihan',
        loadComponent: () =>
          import('./pages/dashboard/area/area.component').then(
            (m) => m.AreaComponent,
          ),
        canActivate: [roleGuard('kolektor')],
      },
      {
        path: 'kolektor/janji-bayar',
        loadComponent: () => import('./pages/dashboard/kolektor/promises/collector-promises.component').then(m => m.CollectorPromisesComponent),
        canActivate: [roleGuard('kolektor')],
      },
      {
        path: 'kolektor/titipan',
        loadComponent: () =>
          import('./pages/dashboard/finance/deposits/finance-deposits.component').then(
            (m) => m.FinanceDepositsComponent,
          ),
        canActivate: [roleGuard('kolektor')],
      },
      {
        path: 'finance/tagihan',
        loadComponent: () =>
          import('./pages/dashboard/finance/invoices/finance-invoices.component').then(
            (m) => m.FinanceInvoicesComponent,
          ),
        canActivate: [roleGuard('finance')],
      },
      {
        path: 'pengaturan',
        loadComponent: () =>
          import('./pages/dashboard/tools/pengaturan/pengaturan.component').then(
            (m) => m.PengaturanComponent,
          ),
        canActivate: [adminGuard],
      },
      { path: 'tools/pengaturan', redirectTo: 'pengaturan', pathMatch: 'full' },
      {
        path: 'bot-whatsapp/status',
        loadComponent: () =>
          import('./pages/dashboard/bot-whatsapp/status/bot-wa-status.component').then(
            (m) => m.BotWaStatusComponent,
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'bot-whatsapp/template',
        loadComponent: () =>
          import('./pages/dashboard/bot-whatsapp/template/bot-wa-template.component').then(
            (m) => m.BotWaTemplateComponent,
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'bot-whatsapp/logs',
        loadComponent: () =>
          import('./pages/dashboard/bot-whatsapp/logs/bot-wa-logs.component').then(
            (m) => m.BotWaLogsComponent,
          ),
        canActivate: [adminGuard],
      },

      // Finance
      {
        path: 'finance/gaji',
        loadComponent: () => import('./pages/dashboard/finance/salary/finance-salary.component').then(m => m.FinanceSalaryComponent),
        canActivate: [roleGuard('finance')],
      },
      {
        path: 'finance/ringkasan',
        loadComponent: () =>
          import('./pages/dashboard/finance/summary/finance-summary.component').then(
            (m) => m.FinanceSummaryComponent,
          ),
        canActivate: [roleGuard('finance')],
      },
      {
        path: 'finance/transaksi',
        loadComponent: () =>
          import('./pages/dashboard/finance/transactions/finance-transactions.component').then(
            (m) => m.FinanceTransactionsComponent,
          ),
        canActivate: [roleGuard('finance')],
      },
      {
        path: 'finance/setoran',
        loadComponent: () =>
          import('./pages/dashboard/finance/deposits/finance-deposits.component').then(
            (m) => m.FinanceDepositsComponent,
          ),
        canActivate: [roleGuard('finance')],
      },

      // Area
      {
        path: 'area',
        loadComponent: () =>
          import('./pages/dashboard/area/area.component').then(
            (m) => m.AreaComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

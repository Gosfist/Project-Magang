import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { LandingComponent } from './pages/landing/landing.component';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { HomeComponent } from './pages/dashboard/home/home.component';
import { UsersComponent } from './pages/dashboard/users/users.component';
import { PaketLayananComponent } from './pages/dashboard/pppoe/paket-layanan/paket-layanan.component';
import { DataPelangganComponent } from './pages/dashboard/pppoe/data-pelanggan/data-pelanggan.component';
import { KalkulatorRedamanComponent } from './pages/dashboard/tools/kalkulator-redaman/kalkulator-redaman.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomeComponent },
      { path: 'monitoring/server', loadComponent: () => import('./pages/dashboard/monitoring/server/server.component').then((m) => m.ServerMonitoringComponent), canActivate: [roleGuard('admin')] },
      { path: 'monitoring/router', loadComponent: () => import('./pages/dashboard/monitoring/router/router-monitoring.component').then((m) => m.RouterMonitoringComponent), canActivate: [roleGuard('admin')] },
      { path: 'monitoring/radius', loadComponent: () => import('./pages/dashboard/monitoring/radius/radius-monitoring.component').then((m) => m.RadiusMonitoringComponent), canActivate: [roleGuard('admin')] },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      {
        path: 'mainCore',
        canActivate: [roleGuard('admin', 'teknisi')],
        children: [
          { path: '', redirectTo: 'traceJalur', pathMatch: 'full' },
          {
            path: 'traceJalur',
            loadComponent: () =>
              import('./pages/dashboard/main-core/trace-jalur/trace-jalur.component').then(
                (component) => component.TraceJalurComponent
              ),
          },
          {
            path: 'server',
            loadComponent: () =>
              import('./pages/dashboard/main-core/server/server.component').then(
                (component) => component.ServerComponent
              ),
          },
          {
            path: 'rasio',
            loadComponent: () =>
              import('./pages/dashboard/main-core/rasio/rasio.component').then(
                (component) => component.RasioComponent
              ),
          },
          {
            path: 'odc',
            loadComponent: () =>
              import('./pages/dashboard/main-core/odc/odc.component').then(
                (component) => component.OdcComponent
              ),
          },
          {
            path: 'odp',
            loadComponent: () =>
              import('./pages/dashboard/main-core/odp/odp.component').then(
                (component) => component.OdpComponent
              ),
          },
        ],
      },
      { path: 'pppoe/paket-layanan', component: PaketLayananComponent, canActivate: [roleGuard('admin')] },
      { path: 'pppoe/data-pelanggan', component: DataPelangganComponent, canActivate: [roleGuard('admin')] },
      { path: 'pppoe/ip-pools', loadComponent: () => import('./pages/dashboard/pppoe/ip-pools/ip-pools.component').then(m => m.IpPoolsComponent), canActivate: [roleGuard('admin')] },
      { path: 'router/routers', loadComponent: () => import('./pages/dashboard/router/routers/routers.component').then(m => m.RoutersComponent), canActivate: [roleGuard('admin')] },
      { path: 'router/vpn-server', loadComponent: () => import('./pages/dashboard/router/vpn-server/vpn-server.component').then(m => m.VpnServerComponent), canActivate: [roleGuard('admin')] },
      { path: 'router/vpn-client', loadComponent: () => import('./pages/dashboard/router/vpn-client/vpn-client.component').then(m => m.VpnClientComponent), canActivate: [roleGuard('admin')] },
      { path: 'tools/kalkulator-redaman', component: KalkulatorRedamanComponent, canActivate: [roleGuard('admin', 'teknisi')] },
      { path: 'registrasi-pelanggan', loadComponent: () => import('./pages/dashboard/psb/psb.component').then(m => m.PsbComponent), canActivate: [roleGuard('admin', 'sales')] },
      { path: 'pasang-baru', loadComponent: () => import('./pages/dashboard/psb/psb.component').then(m => m.PsbComponent), canActivate: [roleGuard('admin', 'teknisi')] },
      { path: 'kolektor/tagihan', loadComponent: () => import('./pages/dashboard/area/area.component').then(m => m.AreaComponent), canActivate: [roleGuard('admin', 'kolektor')] },
      { path: 'kolektor/titipan', loadComponent: () => import('./pages/dashboard/finance/deposits/finance-deposits.component').then(m => m.FinanceDepositsComponent), canActivate: [roleGuard('admin', 'kolektor')] },
      { path: 'finance/tagihan', loadComponent: () => import('./pages/dashboard/finance/deposits/finance-deposits.component').then(m => m.FinanceDepositsComponent), canActivate: [roleGuard('admin', 'finance')] },
      { path: 'tools/pengaturan', loadComponent: () => import('./pages/dashboard/tools/pengaturan/pengaturan.component').then(m => m.PengaturanComponent), canActivate: [adminGuard] },
      { path: 'bot-whatsapp/status', loadComponent: () => import('./pages/dashboard/bot-whatsapp/status/bot-wa-status.component').then(m => m.BotWaStatusComponent), canActivate: [adminGuard] },
      { path: 'bot-whatsapp/template', loadComponent: () => import('./pages/dashboard/bot-whatsapp/template/bot-wa-template.component').then(m => m.BotWaTemplateComponent), canActivate: [adminGuard] },
      { path: 'bot-whatsapp/logs', loadComponent: () => import('./pages/dashboard/bot-whatsapp/logs/bot-wa-logs.component').then(m => m.BotWaLogsComponent), canActivate: [adminGuard] },

      // Finance
      {
        path: 'finance/ringkasan',
        loadComponent: () =>
          import('./pages/dashboard/finance/summary/finance-summary.component').then(
            (m) => m.FinanceSummaryComponent,
          ),
        canActivate: [roleGuard('admin', 'finance')],
      },
      {
        path: 'finance/transaksi',
        loadComponent: () =>
          import('./pages/dashboard/finance/transactions/finance-transactions.component').then(
            (m) => m.FinanceTransactionsComponent,
          ),
        canActivate: [roleGuard('admin', 'finance')],
      },
      {
        path: 'finance/setoran',
        loadComponent: () =>
          import('./pages/dashboard/finance/deposits/finance-deposits.component').then(
            (m) => m.FinanceDepositsComponent,
          ),
        canActivate: [roleGuard('admin', 'finance', 'kolektor')],
      },

      // Area
      {
        path: 'area',
        loadComponent: () =>
          import('./pages/dashboard/area/area.component').then(
            (m) => m.AreaComponent,
          ),
        canActivate: [roleGuard('admin', 'finance', 'kolektor')],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

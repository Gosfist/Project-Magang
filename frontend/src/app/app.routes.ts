import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { LandingComponent } from './pages/landing/landing.component';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { HomeComponent } from './pages/dashboard/home/home.component';
import { UsersComponent } from './pages/dashboard/users/users.component';
import { PackagesComponent } from './pages/dashboard/pppoe/packages/packages.component';
import { AccountsComponent } from './pages/dashboard/pppoe/accounts/accounts.component';
import { AttenuationCalculatorComponent } from './pages/dashboard/tools/attenuation-calculator/attenuation-calculator.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomeComponent },
      { path: 'monitoring/server', loadComponent: () => import('./pages/dashboard/monitoring/server/server.component').then((m) => m.ServerMonitoringComponent) },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      {
        path: 'mainCore',
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
      { path: 'pppoe/packages', component: PackagesComponent },
      { path: 'pppoe/accounts', component: AccountsComponent },
      { path: 'pppoe/ip-pools', loadComponent: () => import('./pages/dashboard/pppoe/ip-pools/ip-pools.component').then(m => m.IpPoolsComponent) },
      { path: 'router/routers', loadComponent: () => import('./pages/dashboard/router/routers/routers.component').then(m => m.RoutersComponent) },
      { path: 'router/vpn-server', loadComponent: () => import('./pages/dashboard/router/vpn-server/vpn-server.component').then(m => m.VpnServerComponent) },
      { path: 'router/vpn-client', loadComponent: () => import('./pages/dashboard/router/vpn-client/vpn-client.component').then(m => m.VpnClientComponent) },
      { path: 'tools/attenuation-calculator', component: AttenuationCalculatorComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];

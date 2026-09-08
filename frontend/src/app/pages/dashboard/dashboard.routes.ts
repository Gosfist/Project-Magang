import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';
import { HomeComponent } from './home/home.component';
import { UsersComponent } from './users/users.component';
import { MainCoreComponent } from './main-core/main-core.component';
import { TraceComponent } from './main-core/trace/trace.component';
import { PackagesComponent } from './pppoe/packages/packages.component';
import { AccountsComponent } from './pppoe/accounts/accounts.component';
import { AttenuationCalculatorComponent } from './tools/attenuation-calculator/attenuation-calculator.component';

export const dashboardRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
  { path: 'main-core/trace', component: TraceComponent },
  { path: 'main-core/:type', component: MainCoreComponent },
  { path: 'pppoe/packages', component: PackagesComponent },
  { path: 'pppoe/accounts', component: AccountsComponent },
  { path: 'tools/attenuation-calculator', component: AttenuationCalculatorComponent },
];

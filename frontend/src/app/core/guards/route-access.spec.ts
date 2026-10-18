import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, Routes, CanActivateFn } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthService } from '../services/auth.service';

describe('Dashboard URL access', () => {
  let role: string | null;
  let additionalRoles: string[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { user: () => role ? { role, additionalRoles } : null, loading: () => false } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands.join('/') } },
    ] });
  });

  const expected: Record<string, string[]> = {
    '': ['admin', 'finance', 'kolektor', 'sales', 'teknisi'],
    users: ['admin'], sales: ['admin'], mainCore: ['admin', 'teknisi'],
    'teknisi/data-pelanggan': ['teknisi'], 'registrasi-pelanggan': ['sales'],
    'pasang-baru': ['teknisi'], 'kolektor/tagihan': ['kolektor'],
    'kolektor/janji-bayar': ['kolektor'], 'kolektor/titipan': ['kolektor'], area: ['admin'],
    'tools/kalkulator-redaman': ['admin', 'teknisi'],
  };
  const dashboard = routes.find(r => r.path === 'dashboard')!;
  it('removes the VPN client URL while keeping Router / NAS available', () => {
    expect(dashboard.children!.some(route => route.path === 'router/vpn-client')).toBeFalse();
    expect(dashboard.children!.some(route => route.path === 'router/routers')).toBeTrue();
  });
  it('removes router monitoring while retaining server and RADIUS monitoring', () => {
    expect(dashboard.children!.some(route => route.path === 'monitoring/router')).toBeFalse();
    expect(dashboard.children!.some(route => route.path === 'monitoring/server')).toBeTrue();
    expect(dashboard.children!.some(route => route.path === 'monitoring/radius')).toBeTrue();
  });
  function checkRoutes(children: Routes, inherited: CanActivateFn[] = [], prefix = ''): void {
    for (const route of children) {
      if (route.redirectTo !== undefined) continue;
      const path = prefix + route.path;
      const guards = [...inherited, ...(route.canActivate ?? [])] as CanActivateFn[];
      const dashboardRole = /^(finance|sales|kolektor|teknisi)\/dashboard$/.exec(path)?.[1];
      const allowed = (dashboardRole ? [dashboardRole] : expected[path]) ?? (path.startsWith('mainCore/') ? ['admin', 'teknisi'] : path.startsWith('finance/') ? ['finance'] : ['admin']);
      for (const currentRole of ['admin', 'finance', 'kolektor', 'sales', 'teknisi', null]) {
        it(`${path || 'home'}: ${currentRole ?? 'anonymous'}`, async () => {
          role = currentRole;
          let result: unknown = true;
          for (const guard of guards) {
            const value = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
            result = await (isObservable(value) ? firstValueFrom(value) : value);
            if (result !== true) break;
          }
          expect(result === true).toBe(currentRole !== null && (currentRole === 'admin' || allowed.includes(currentRole)));
        });
      }
      if (route.children) checkRoutes(route.children, [...guards, ...(route.canActivateChild ?? [])] as CanActivateFn[], path + '/');
    }
  }
  checkRoutes(dashboard.children!, dashboard.canActivate as CanActivateFn[]);
  it('grants added Sales and Kolektor access to Finance without granting administrator access', async () => {
    role = 'finance'; additionalRoles = ['sales', 'kolektor'];
    for (const path of ['registrasi-pelanggan', 'kolektor/tagihan', 'users', 'pasang-baru']) {
      const route = dashboard.children!.find(item => item.path === path)!;
      let allowed: unknown = true;
      for (const guard of route.canActivate as CanActivateFn[]) {
        allowed = await TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url: '/dashboard/' + path } as RouterStateSnapshot));
        if (allowed !== true) break;
      }
      expect(allowed === true).toBe(['registrasi-pelanggan', 'kolektor/tagihan'].includes(path));
    }
    additionalRoles = [];
  });
});

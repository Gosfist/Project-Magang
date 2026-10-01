import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, Routes, CanActivateFn } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthService } from '../services/auth.service';

describe('Dashboard URL access', () => {
  let role: string | null;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { user: () => role ? { role } : null, loading: () => false } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands.join('/') } },
    ] });
  });

  const expected: Record<string, string[]> = {
    '': ['admin', 'finance', 'kolektor', 'sales', 'teknisi'],
    users: ['admin'], sales: ['admin'], mainCore: ['admin', 'teknisi'],
    'teknisi/data-pelanggan': ['teknisi'], 'registrasi-pelanggan': ['sales'],
    'pasang-baru': ['teknisi'], 'kolektor/tagihan': ['kolektor'],
    'kolektor/titipan': ['kolektor'], area: ['admin'],
    'tools/kalkulator-redaman': ['admin', 'teknisi'],
  };
  const dashboard = routes.find(r => r.path === 'dashboard')!;
  function checkRoutes(children: Routes, inherited: CanActivateFn[] = [], prefix = ''): void {
    for (const route of children) {
      if (route.redirectTo !== undefined) continue;
      const path = prefix + route.path;
      const guards = [...inherited, ...(route.canActivate ?? [])] as CanActivateFn[];
      const allowed = expected[path] ?? (path.startsWith('mainCore/') ? ['admin', 'teknisi'] : path.startsWith('finance/') ? ['finance'] : ['admin']);
      for (const currentRole of ['admin', 'finance', 'kolektor', 'sales', 'teknisi', null]) {
        it(`${path || 'home'}: ${currentRole ?? 'anonymous'}`, async () => {
          role = currentRole;
          let result: unknown = true;
          for (const guard of guards) {
            const value = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
            result = await (isObservable(value) ? firstValueFrom(value) : value);
            if (result !== true) break;
          }
          expect(result === true).toBe(currentRole !== null && allowed.includes(currentRole));
        });
      }
      if (route.children) checkRoutes(route.children, [...guards, ...(route.canActivateChild ?? [])] as CanActivateFn[], path + '/');
    }
  }
  checkRoutes(dashboard.children!, dashboard.canActivate as CanActivateFn[]);
});

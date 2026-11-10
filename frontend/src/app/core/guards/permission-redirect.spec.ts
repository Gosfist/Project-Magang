import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';
import { dashboardGuard } from './dashboard.guard';
import { routes } from '../../app.routes';

@Component({ selector: 'test-permission-shell', standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class Shell {}
@Component({ selector: 'test-permission-dashboard', standalone: true, template: 'Own dashboard' })
class Dashboard {}

describe('Direct forbidden URLs preserve the authenticated session', () => {
  afterEach(() => localStorage.removeItem('unzanet_token'));
  for (const role of ['sales', 'finance', 'kolektor', 'teknisi']) {
    it(`redirects ${role} away from admin URLs to its primary dashboard`, async () => {
      localStorage.setItem('unzanet_token', 'valid-token');
      const user = signal({ role, additionalRoles: [] });
      const accessContext = signal<string | null>('finance');
      TestBed.configureTestingModule({ providers: [
        { provide: AuthService, useValue: { user, accessContext, loading: () => false } },
        provideRouter([{ path: 'dashboard', component: Shell, children: [
          { path: 'users', component: Dashboard, canActivate: [roleGuard('admin')] },
          { path: '', component: Dashboard, canActivate: [dashboardGuard] },
        ] }]),
      ] });
      const harness = await RouterTestingHarness.create('/dashboard/users');
      expect(TestBed.inject(Router).url).toBe('/dashboard');
      expect(harness.routeNativeElement?.textContent).toContain('Own dashboard');
      expect(user().role).toBe(role);
      expect(localStorage.getItem('unzanet_token')).toBe('valid-token');
      expect(accessContext()).toBeNull();
    });
  }

  it('redirects every legacy role dashboard to the shared URL and clears role context before activation', async () => {
    const accessContext = signal<string | null>('finance');
    const user = signal({ role: 'sales', additionalRoles: ['finance'] });
    const dashboardRoutes = routes.find(route => route.path === 'dashboard')!.children!;
    const aliases = dashboardRoutes.filter(route => /^(sales|finance|teknisi|kolektor)\/dashboard$/.test(route.path ?? ''));
    expect(aliases.length).toBe(4);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { user, accessContext, loading: () => false } },
      provideRouter([{ path: 'dashboard', component: Shell, children: [
        ...aliases,
        { path: 'finance/tagihan', component: Dashboard, canActivate: [roleGuard('finance')] },
        { path: '', component: Dashboard, canActivate: [dashboardGuard] },
      ] }]),
    ] });
    const harness = await RouterTestingHarness.create('/dashboard/finance/tagihan');
    expect(accessContext()).toBe('finance');
    await harness.navigateByUrl('/dashboard');
    expect(accessContext()).toBeNull();
    for (const role of ['sales', 'finance', 'teknisi', 'kolektor']) {
      await harness.navigateByUrl(`/dashboard/${role}/dashboard`);
      expect(TestBed.inject(Router).url).toBe('/dashboard');
      expect(accessContext()).toBeNull();
      expect(user().role).toBe('sales');
    }
  });
});

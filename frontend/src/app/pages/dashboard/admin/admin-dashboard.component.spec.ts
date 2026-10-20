import { HttpClient } from '@angular/common/http';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { AdminDashboardComponent } from './admin-dashboard.component';

describe('Administrator dashboard', () => {
  const stats = { totalCustomers: 120, totalRouters: 3, newOrders: 5, activatedOrders: 2,
    totalServerCores: 1, totalOdcs: 4, totalOdps: 20, totalTeknisi: 6, totalUsers: 12,
    unpaidInvoices: 8, unpaidInvoiceAmount: 1200000 };
  const finance = { monthlyIncome: 15000000, monthlyExpense: 2000000, monthlyBalance: 13000000,
    monthlyIncomeCount: 100, monthlyExpenseCount: 3, pendingDeposits: 4 };
  let get: jasmine.Spy;
  let botGet: jasmine.Spy;
  let hidden: jasmine.Spy;

  beforeEach(() => {
    get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/dashboard/stats' ? stats : finance));
    botGet = jasmine.createSpy('get').and.returnValue(of({ status: 'connected', botNumber: '6281200000000', uptime: 3660 }));
    hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    TestBed.configureTestingModule({ imports: [AdminDashboardComponent], providers: [provideRouter([]),
      { provide: ApiService, useValue: { get } },
      { provide: HttpClient, useValue: { get: botGet } },
      { provide: AuthService, useValue: { user: () => ({ name: 'Administrator' }) } },
    ] });
  });

  function setup() {
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  it('renders operational and financial totals, bot status and shortcuts to existing menus', () => {
    const { element, component } = setup();
    expect(get).toHaveBeenCalledWith('/dashboard/stats');
    expect(get).toHaveBeenCalledWith(jasmine.stringMatching(/^\/finance\/summary\?month=\d+&year=\d+$/));
    expect(botGet).toHaveBeenCalledWith(`${environment.botWaUrl}/status`);
    expect(element.textContent).toContain('Rp 15.000.000');
    expect(element.textContent).toContain('Rp 13.000.000');
    expect(element.textContent).toContain('Rp 1.200.000');
    expect(element.textContent).toContain('Terhubung');
    expect(element.textContent).toContain('1 jam 1 menit');
    const shortcuts = [...element.querySelectorAll<HTMLAnchorElement>('.shortcut-link')];
    expect(shortcuts.map(link => link.getAttribute('href'))).toEqual(component.shortcuts.map(shortcut => shortcut.path));
    expect(shortcuts.length).toBe(10);
    expect(element.querySelectorAll('.metric-card').length).toBe(4);
  });

  it('keeps other summaries visible when Finance fails without claiming a zero balance', () => {
    get.and.callFake((url: string) => url === '/dashboard/stats' ? of(stats) : throwError(() => new Error('offline')));
    const { component, element } = setup();
    expect(component.stats()?.totalCustomers).toBe(120);
    expect(element.textContent).toContain('Ringkasan keuangan belum dapat dimuat.');
    expect(element.textContent).toContain('Terhubung');
    expect(element.textContent).not.toContain('Rp 0');
    expect(component.finance()).toBeNull();
  });

  it('reports an unavailable bot separately from a disconnected WhatsApp session', () => {
    botGet.and.returnValue(throwError(() => new Error('offline')));
    const { component, element } = setup();
    expect(element.textContent).toContain('Tidak dapat dihubungi');
    expect(element.textContent).not.toContain('Terputus');
    expect(component.finance()?.monthlyIncome).toBe(15000000);
  });

  it('shows an operational error and removes previous values after a failed refresh', () => {
    const { fixture, component, element } = setup();
    get.and.callFake((url: string) => url === '/dashboard/stats' ? throwError(() => new Error('offline')) : of(finance));
    component.refresh(); fixture.detectChanges();
    expect(component.stats()).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Ringkasan operasional belum dapat dimuat');
    expect(element.querySelector('.metric-card')?.textContent).toContain('—');
    expect(component.finance()?.pendingDeposits).toBe(4);
  });

  it('cancels outdated requests on refresh and cancels active requests when destroyed', () => {
    const pending = new Subject<unknown>();
    get.and.returnValue(pending);
    const { fixture, component } = setup();
    expect(pending.observed).toBeTrue();
    get.and.callFake((url: string) => of(url === '/dashboard/stats' ? stats : finance));
    component.refresh();
    expect(pending.observed).toBeFalse();
    expect(component.stats()?.totalCustomers).toBe(120);
    get.and.returnValue(pending);
    component.refresh();
    fixture.destroy();
    expect(pending.observed).toBeFalse();
  });

  it('refreshes every minute only while visible and stops when destroyed', fakeAsync(() => {
    const { fixture } = setup();
    expect(get.calls.count()).toBe(2);
    tick(60000);
    expect(get.calls.count()).toBe(4);
    hidden.and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    tick(60000);
    expect(get.calls.count()).toBe(4);
    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(get.calls.count()).toBe(6);
    fixture.destroy();
    tick(60000);
    expect(get.calls.count()).toBe(6);
  }));
});

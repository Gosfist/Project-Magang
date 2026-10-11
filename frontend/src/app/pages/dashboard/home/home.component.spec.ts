import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

describe('Collector dashboard', () => {
  const summary = { totalCustomers: 3, unpaidCustomers: 1, paidCustomers: 2, totalUnpaidAmount: 110000 };
  let get: jasmine.Spy;

  beforeEach(async () => {
    get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/areas/customers'
      ? { summary } : { assignedCustomers: 3, pendingDeposits: 0, acceptedDeposits: 2 }));
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]),
        { provide: ApiService, useValue: { get } },
        { provide: AuthService, useValue: {
          user: () => ({ name: 'Kolektor' }), isKolektor: () => true,
          isAdmin: () => false, isSales: () => false, isTeknisi: () => false, isFinance: () => false,
        } },
      ],
    }).compileComponents();
  });

  it('renders billing totals and links to matching customer filters', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).not.toContain('Total Tunggakan');
    expect(element.textContent).not.toContain('110.000');
    expect(element.textContent).not.toContain('Pelanggan Tugas');
    expect(element.textContent).not.toContain('Ringkasan data jaringan');
    const links = Array.from(element.querySelectorAll('a')).map(link => link.getAttribute('href'));
    expect(links).toEqual([
      '/dashboard/kolektor/tagihan?status=UNPAID',
      '/dashboard/kolektor/tagihan?status=PAID',
      '/dashboard/kolektor/tagihan?status=ALL',
    ]);
  });

  it('does not display false zero totals when the summary request fails', () => {
    get.and.callFake((url: string) => url === '/areas/customers'
      ? throwError(() => new Error('offline')) : of({}));
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gagal memuat ringkasan tagihan.');
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(0);
  });
});

describe('Sales dashboard periods', () => {
  let get: jasmine.Spy;
  const response = { monthlyRegistrations: 3, monthlyCompletedOrders: 2, monthlySalary: 100000, salaryRate: 50000,
    year: 2027, month: 2, startYear: 2026, startMonth: 10, currentYear: 2027, currentMonth: 2 };
  beforeEach(async () => {
    get = jasmine.createSpy('get').and.callFake((url: string) => {
      const query = new URL('http://test' + url).searchParams;
      return of({ ...response, year: Number(query.get('year') || response.year), month: Number(query.get('month') || response.month) });
    });
    await TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([]),
      { provide: ApiService, useValue: { get } },
      { provide: AuthService, useValue: { user: () => ({ name: 'Sales' }), isSales: () => true,
        isAdmin: () => false, isTeknisi: () => false, isKolektor: () => false, isFinance: () => false } },
    ] }).compileComponents();
  });
  it('shows only the three period totals and defaults to the server current month', () => {
    const fixture = TestBed.createComponent(HomeComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.cards().map(card => card.label)).toEqual(['Inputan', 'Selesai', 'Gaji']);
    expect(component.selectedYear).toBe(2027); expect(component.selectedMonth).toBe(2);
    expect(component.years).toEqual([2026, 2027]);
    expect(component.months.map(month => month.value)).toEqual([1, 2]);
  });
  it('limits the creation year to October onward and fetches the selected historical period', () => {
    const fixture = TestBed.createComponent(HomeComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectedYear = 2026; component.changeYear();
    expect(component.months.map(month => month.value)).toEqual([10, 11, 12]);
    expect(component.selectedMonth).toBe(10);
    expect(get).toHaveBeenCalledWith('/dashboard/stats?year=2026&month=10');
    component.selectedMonth = 12; component.loadStats();
    expect(get).toHaveBeenCalledWith('/dashboard/stats?year=2026&month=12');
  });
  it('clears totals when a period request fails', () => {
    const fixture = TestBed.createComponent(HomeComponent); fixture.detectChanges();
    get.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentInstance.loadStats(); fixture.detectChanges();
    expect(fixture.componentInstance.cards()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('offline');
  });
});

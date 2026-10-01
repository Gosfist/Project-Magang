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

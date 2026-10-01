import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AreaComponent } from './area.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

describe('Collector billing filters', () => {
  for (const [input, expected] of [['UNPAID', 'UNPAID'], ['PAID', 'PAID'], ['ALL', 'ALL'], ['invalid', 'ALL']]) {
    it(`opens ${input} with the appropriate filter`, () => {
      const get = jasmine.createSpy('get').and.returnValue(of({
        area: { id: 'collector-all', name: 'Daftar Tagihan' },
        summary: { totalCustomers: 0, unpaidCustomers: 0, paidCustomers: 0, totalUnpaidAmount: 0 },
        customers: [],
      }));
      TestBed.configureTestingModule({ providers: [
        { provide: ApiService, useValue: { get } },
        { provide: AuthService, useValue: { isKolektor: () => true } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ status: input }) } } },
      ] });
      const component = TestBed.runInInjectionContext(() => new AreaComponent());
      component.ngOnInit();
      expect(component.customerStatusFilter()).toBe(expected);
      expect(get).toHaveBeenCalledWith(`/areas/customers?status=${expected}`);
    });
  }
});

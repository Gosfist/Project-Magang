import { TestBed } from '@angular/core/testing';
import { TraceJalurComponent } from './trace-jalur.component';
import { ApiService } from '../../../../core/services/api.service';

describe('trace location search', () => {
  it('updates options when text or category changes without reloading data', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
    const component = TestBed.runInInjectionContext(() => new TraceJalurComponent());
    component.options.set([
      { id: '1', namaTitik: 'ODP Utara', tipeTitik: 'odp' },
      { id: '2', namaTitik: 'ODP Selatan', tipeTitik: 'odp' },
      { id: '3', namaTitik: 'ODC Utara', tipeTitik: 'odc' },
    ]);
    component.category = 'odp';
    expect(component.filteredOptions().length).toBe(2);
    component.search = ' utara ';
    expect(component.filteredOptions().map(item => item.id)).toEqual(['1']);
    component.category = 'odc';
    expect(component.filteredOptions().map(item => item.id)).toEqual(['3']);
  });
});

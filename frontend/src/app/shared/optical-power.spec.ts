import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { OdcComponent } from '../pages/dashboard/main-core/odc/odc.component';
import { OdpComponent } from '../pages/dashboard/main-core/odp/odp.component';
import { RasioComponent } from '../pages/dashboard/main-core/rasio/rasio.component';
import { KalkulatorRedamanComponent } from '../pages/dashboard/tools/kalkulator-redaman/kalkulator-redaman.component';
import { estimateInputPower, OpticalParent } from './optical-power';

describe('Optical power direction and Main Core consistency', () => {
  const server: OpticalParent = { type: 'server', redamanIn: -5, outputCount: 0, rasioRedamanPorts: {} };
  it('subtracts passive loss from a negative source instead of creating gain', () => {
    expect(estimateInputPower(server, 0, '')).toBe('-7.00');
    expect(estimateInputPower(server, 100, '')).toBe('-7.04');
    expect(estimateInputPower(server, 1000, '')).toBe('-7.35');
    expect(estimateInputPower({ ...server, redamanIn: 0 }, 100, '')).toBe('-2.04');
  });
  it('applies the parent splitter, selected ratio branch and two connectors on every segment', () => {
    const odc = { ...server, type: 'odc', outputCount: 4 };
    expect(estimateInputPower(odc, 100, '1')).toBe('-13.06');
    const ratio = { ...server, type: 'rasio', outputCount: 2, rasioRedamanPorts: { '1': '10%', '2': '90%' } };
    expect(estimateInputPower(ratio, 100, '1')).toBe('-17.04');
    expect(estimateInputPower(ratio, 100, '2')).toBe('-7.49');
  });
  it('matches the calculator for the same -6 dBm, 250m, 1:2 source branch', () => {
    const calculator = new KalkulatorRedamanComponent();
    calculator.source.set(-6); calculator.distance.set(250);
    const parent = { ...server, type: 'odc', redamanIn: -6, outputCount: 2 };
    expect(estimateInputPower(parent, 250, '1')).toBe('-11.10');
    expect(Number(estimateInputPower(parent, 250, '1'))).toBe(Number(calculator.result().redaman.toFixed(2)));
    expect(estimateInputPower({ ...server, redamanIn: -6 }, 250, '')).toBe('-8.09');
  });
  it('does not substitute zero dBm for unknown power or estimate an unselected branch', () => {
    expect(estimateInputPower({ ...server, redamanIn: null }, 100, '')).toBe('');
    expect(estimateInputPower(server, -1, '')).toBe('');
    expect(estimateInputPower({ ...server, type: 'odc', outputCount: 2 }, 100, '')).toBe('');
    expect(estimateInputPower({ ...server, type: 'rasio', outputCount: 2 }, 100, '1')).toBe('');
  });
  it('matches the documented ODC and ODP splitter examples and asymmetric branches', () => {
    for (const type of ['odc', 'odp']) {
      const parent = { ...server, type, redamanIn: -6, outputCount: 2 };
      expect(estimateInputPower(parent, 250, '1')).toBe('-11.10');
      expect(estimateInputPower({ ...parent, outputCount: 4 }, 250, '1')).toBe('-14.11');
    }
    const ratio = { ...server, type: 'rasio', redamanIn: -6, outputCount: 2, rasioRedamanPorts: { '1': '10%', '2': '90%' } };
    expect(estimateInputPower(ratio, 250, '1')).toBe('-18.09');
    expect(estimateInputPower(ratio, 250, '2')).toBe('-8.55');
    const odcPower = Number(estimateInputPower({ ...server, redamanIn: -4 }, 100, ''));
    expect(odcPower).toBe(-6.04);
    const odpPower = Number(estimateInputPower({ ...server, type: 'odc', redamanIn: odcPower, outputCount: 2 }, 250, '1'));
    expect(odpPower).toBe(-11.14);
    expect(estimateInputPower({ ...server, type: 'odp', redamanIn: odpPower, outputCount: 4 }, 100, '1')).toBe('-19.20');
  });
  for (const componentType of [OdcComponent, OdpComponent, RasioComponent]) {
    it(`${componentType.name} clears power after clearing the distance input and does not save empty inputs as zero`, async () => {
      const api = jasmine.createSpyObj('ApiService', ['get', 'post']);
      api.get.and.returnValue(of({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 5, total: 0 } }));
      api.post.and.returnValue(of({ message: 'Tersimpan' }));
      TestBed.configureTestingModule({ imports: [componentType], providers: [{ provide: ApiService, useValue: api }] });
      const fixture = TestBed.createComponent<OdcComponent | OdpComponent | RasioComponent>(componentType);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.parents.set([{ ...server, id: '1', name: 'Server', splitterRatio: null, usedPorts: [] }]);
      component.parentCategory = 'server';
      component.form.parentId = '1';
      component.open.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const distance = fixture.nativeElement.querySelector('input[name="jarakKabel"]') as HTMLInputElement;
      const power = fixture.nativeElement.querySelector('input[name="redamanIn"]') as HTMLInputElement;
      const setDistance = async (value: string) => {
        distance.value = value;
        distance.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      };
      await setDistance('100');
      expect(power.value).toBe('-7.04');
      await setDistance('');
      expect(power.value).toBe('');
      expect(component.autoRedaman()).toBe('');
      await setDistance('0');
      expect(power.value).toBe('-7.00');
      await setDistance('');
      expect(power.value).toBe('');
      component.save();
      expect(api.post).toHaveBeenCalledWith(jasmine.any(String), jasmine.objectContaining({
        jarakKabel: undefined, redamanIn: undefined,
      }));
    });
    it(`${componentType.name} uses the same signed-power calculation and keeps missing power blank`, () => {
      TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
      const component = TestBed.runInInjectionContext(() => new componentType());
      const parent = { ...server, id: '1', name: 'Server', splitterRatio: null, usedPorts: [] };
      component.parents.set([parent]);
      component.form.parentId = '1'; component.form.jarakKabel = '100';
      expect(component.autoRedaman()).toBe('-7.04');
      component.parents.set([{ ...parent, redamanIn: null }]);
      expect(component.autoRedaman()).toBe('');
    });
  }
});

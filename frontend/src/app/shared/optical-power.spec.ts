import { TestBed } from '@angular/core/testing';
import { ApiService } from '../core/services/api.service';
import { OdcComponent } from '../pages/dashboard/main-core/odc/odc.component';
import { OdpComponent } from '../pages/dashboard/main-core/odp/odp.component';
import { RasioComponent } from '../pages/dashboard/main-core/rasio/rasio.component';
import { estimateInputPower, OpticalParent } from './optical-power';

describe('Optical power direction and Main Core consistency', () => {
  const server: OpticalParent = { type: 'server', redamanIn: -5, outputCount: 0, rasioRedamanPorts: {} };
  it('subtracts passive loss from a negative source instead of creating gain', () => {
    for (const type of ['rasio', 'odc', 'odp'] as const) {
      expect(estimateInputPower(server, 0, '', type)).toBe('-6.00');
      expect(estimateInputPower(server, 100, '', type)).toBe('-6.04');
      expect(estimateInputPower(server, 1000, '', type)).toBe('-6.35');
    }
    expect(estimateInputPower({ ...server, redamanIn: 0 }, 100, '', 'odc')).toBe('-1.03');
  });
  it('applies the parent splitter, selected ratio branch and ODC-to-ODP connectors once', () => {
    const odc = { ...server, type: 'odc', outputCount: 4 };
    expect(estimateInputPower(odc, 100, '1', 'odc')).toBe('-12.06');
    expect(estimateInputPower(odc, 100, '1', 'odp')).toBe('-13.06');
    const ratio = { ...server, type: 'rasio', outputCount: 2, rasioRedamanPorts: { '1': '10%', '2': '90%' } };
    expect(estimateInputPower(ratio, 100, '1', 'odp')).toBe('-16.04');
    expect(estimateInputPower(ratio, 100, '2', 'odp')).toBe('-6.49');
  });
  it('does not substitute zero dBm for unknown power or estimate an unselected branch', () => {
    expect(estimateInputPower({ ...server, redamanIn: null }, 100, '', 'odc')).toBe('');
    expect(estimateInputPower(server, -1, '', 'odc')).toBe('');
    expect(estimateInputPower({ ...server, type: 'odc', outputCount: 2 }, 100, '', 'odp')).toBe('');
    expect(estimateInputPower({ ...server, type: 'rasio', outputCount: 2 }, 100, '1', 'odp')).toBe('');
  });
  for (const componentType of [OdcComponent, OdpComponent, RasioComponent]) {
    it(`${componentType.name} uses the same signed-power calculation and keeps missing power blank`, () => {
      TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
      const component = TestBed.runInInjectionContext(() => new componentType());
      const parent = { ...server, id: '1', name: 'Server', splitterRatio: null, usedPorts: [] };
      component.parents.set([parent]);
      component.form.parentId = '1'; component.form.jarakKabel = '100';
      expect(component.autoRedaman()).toBe('-6.04');
      component.parents.set([{ ...parent, redamanIn: null }]);
      expect(component.autoRedaman()).toBe('');
    });
  }
});

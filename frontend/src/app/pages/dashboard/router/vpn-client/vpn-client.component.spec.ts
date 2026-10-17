import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { VpnClientComponent } from './vpn-client.component';
import { RoutersComponent } from '../routers/routers.component';
import { routes } from '../../../../app.routes';

describe('External WireGuard VPN IP flow', () => {
  function setup() {
    const api = {
      get: jasmine.createSpy('get').and.returnValue(of({ data: [
        { id: '1', name: 'Server RADIUS 10.99.25.7', vpnType: 'wireguard', deviceType: 'radius', vpnIp: '10.99.25.7', isActive: true, routers: [] },
        { id: '2', name: 'MikroTik 10.66.0.44', vpnType: 'wireguard', deviceType: 'mikrotik', vpnIp: '10.66.0.44', isActive: true, routers: [{ id: 1, name: 'NAS A' }] },
        { id: '3', name: 'MikroTik 10.66.0.45', vpnType: 'wireguard', deviceType: 'mikrotik', vpnIp: '10.66.0.45', isActive: false, routers: [] },
      ], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 3 }, legacyCount: 1 })),
      post: jasmine.createSpy('post').and.returnValue(of({ message: 'Disimpan' })),
      patch: jasmine.createSpy('patch').and.returnValue(of({ message: 'Disimpan' })),
    };
    TestBed.configureTestingModule({ imports: [VpnClientComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(VpnClientComponent);
    fixture.detectChanges();
    return { api, fixture, element: fixture.nativeElement as HTMLElement };
  }
  it('renders exact device/IP/status/NAS rows and only checks an active linked MikroTik', () => {
    const { element, api } = setup();
    expect([...element.querySelectorAll('thead th')].map(cell => cell.textContent?.trim())).toEqual([
      'Perangkat', 'IP VPN', 'Status', 'Router / NAS', 'Aksi',
    ]);
    const rows = [...element.querySelectorAll('tbody tr')];
    const cells = rows.map(row => [...row.querySelectorAll('td')].slice(0, 4).map(cell => cell.textContent?.trim()));
    expect(cells).toEqual([
      ['Server RADIUS', '10.99.25.7', 'Aktif', '—'],
      ['MikroTik', '10.66.0.44', 'Aktif', 'NAS A'],
      ['MikroTik', '10.66.0.45', 'Nonaktif', 'Belum dihubungkan'],
    ]);
    expect(rows[0].querySelector('[title="Cek Router"]')).toBeNull();
    expect(rows[1].querySelector('[title="Cek Router"]')).not.toBeNull();
    expect(rows[2].querySelector('[title="Cek Router"]')).toBeNull();
    for (const removed of ['OpenVPN', 'Portmap', 'ZeroTier', '.ovpn', '10 perangkat', 'Unduh Setup']) {
      expect(element.textContent).not.toContain(removed);
    }
    expect(api.get.calls.allArgs()).toEqual([['/router/vpn-client?search=&page=1']]);
  });
  it('requires only device type and VPN IP, and submits a RADIUS peer without keys or provisioning fields', async () => {
    const { fixture, element, api } = setup();
    const component = fixture.componentInstance;
    component.show(); fixture.detectChanges(); await fixture.whenStable();
    for (const name of ['name', 'nodeId', 'networkId', 'description', 'publicHost', 'publicPort', 'subnet', 'clientPrivateKey', 'clientPublicKey', 'isActive']) {
      expect(element.querySelector(`[name="${name}"]`)).toBeNull();
    }
    expect(element.querySelector('[name="deviceType"]')).not.toBeNull();
    expect(element.querySelector('[name="vpnIp"]')).not.toBeNull();
    component.form = { deviceType: 'radius', vpnIp: ' 10.99.25.7 ', isActive: true };
    component.save();
    expect(api.post).toHaveBeenCalledWith('/router/vpn-client', { deviceType: 'radius', vpnIp: '10.99.25.7', isActive: true });
  });
  it('edits the existing device type/IP/state and checks a linked router via the API', async () => {
    const { fixture, element, api } = setup();
    const component = fixture.componentInstance;
    component.show(component.items()[2]); fixture.detectChanges(); await fixture.whenStable();
    expect(component.form).toEqual({ deviceType: 'mikrotik', vpnIp: '10.66.0.45', isActive: false });
    expect(element.querySelector('[name="isActive"]')).not.toBeNull();
    component.form.isActive = true; component.save();
    expect(api.patch).toHaveBeenCalledWith('/router/vpn-client/3', { deviceType: 'mikrotik', vpnIp: '10.66.0.45', isActive: true });
    component.check(component.items()[1]);
    expect(api.post).toHaveBeenCalledWith('/router/vpn-client/2/check', {});
  });
  it('sets API and NAS addresses from the selected WireGuard client', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
    const component = TestBed.runInInjectionContext(() => new RoutersComponent());
    component.vpnClients.set([{ id: '2', name: 'MikroTik', vpnIp: '10.66.0.44' } as any]);
    component.form.vpnClientId = '2'; component.onVpnClientChange();
    expect(component.form.ipAddress).toBe('10.66.0.44');
    expect(component.form.nasname).toBe('10.66.0.44');
  });
  it('keeps VPN clients guarded and does not restore a Server VPN menu', () => {
    const children = routes.find(route => route.path === 'dashboard')!.children!;
    expect(children.some(route => route.path === 'router/vpn-server')).toBeFalse();
    expect(children.find(route => route.path === 'router/vpn-client')?.canActivate?.length).toBeGreaterThan(0);
  });
});

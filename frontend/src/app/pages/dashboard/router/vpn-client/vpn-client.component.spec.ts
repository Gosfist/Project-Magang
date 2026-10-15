import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { VpnClientComponent } from './vpn-client.component';
import { RoutersComponent } from '../routers/routers.component';
import { routes } from '../../../../app.routes';

describe('ZeroTier VPN flow', () => {
  function setup() {
    const api = {
      get: jasmine.createSpy('get').and.returnValue(of({ data: [
        { id: '1', name: 'Ubuntu', networkId: '0123456789abcdef', nodeId: 'abcdef1234', vpnIp: '10.88.0.1', deviceType: 'linux', isRadiusServer: true, isActive: true, routers: [] },
        { id: '2', name: 'Cabang A', networkId: '0123456789abcdef', nodeId: 'abcdef1235', vpnIp: '10.88.0.2', deviceType: 'mikrotik', isRadiusServer: false, isActive: false, routers: [] },
      ], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 2 },
      capacity: { used: 3, limit: 10, remaining: 7, serverRegistered: true, networkId: '0123456789abcdef' } })),
      post: jasmine.createSpy('post').and.returnValue(of({ message: 'Disimpan' })),
    };
    TestBed.configureTestingModule({ imports: [VpnClientComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(VpnClientComponent);
    fixture.detectChanges();
    return { api, fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders all ZeroTier columns, reserved capacity, and clear recording status', () => {
    const { element, api } = setup();
    expect(element.textContent).toContain('3 / 10 perangkat tercatat');
    expect([...element.querySelectorAll('thead th')].map(cell => cell.textContent?.trim())).toEqual([
      'Nama Klien', 'Network ID', 'Node ID', 'IP ZeroTier', 'Perangkat', 'Pencatatan', 'Aksi',
    ]);
    const rows = [...element.querySelectorAll('tbody tr')];
    expect([...rows[0].querySelectorAll('td')].slice(0, 6).map(cell => cell.textContent?.trim())).toEqual([
      'Ubuntu', '0123456789abcdef', 'abcdef1234', '10.88.0.1', 'Ubuntu RADIUS', 'Aktif',
    ]);
    expect([...rows[1].querySelectorAll('td')].slice(0, 6).map(cell => cell.textContent?.trim())).toEqual([
      'Cabang A', '0123456789abcdef', 'abcdef1235', '10.88.0.2', 'MikroTik', 'Nonaktif',
    ]);
    expect(api.get.calls.allArgs().flat().some(url => String(url).includes('vpn-server'))).toBeFalse();
    expect(element.textContent).toContain('Data aktif di tabel bukan status online perangkat.');
  });

  it('defaults to the current network, marks Ubuntu, and submits without WireGuard fields', async () => {
    const { fixture, element, api } = setup();
    fixture.componentInstance.show();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.form.networkId).toBe('0123456789abcdef');
    expect(element.querySelector('[name="clientPrivateKey"]')).toBeNull();
    expect(element.querySelector('[name="vpnServerId"]')).toBeNull();
    const checkbox = element.querySelector<HTMLInputElement>('[name="isRadiusServer"]')!;
    checkbox.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.deviceType).toBe('linux');
    fixture.componentInstance.form.name = 'Ubuntu RADIUS';
    fixture.componentInstance.save();
    const body = api.post.calls.mostRecent().args[1];
    expect(body).toEqual(jasmine.objectContaining({ isRadiusServer: true, deviceType: 'linux', networkId: '0123456789abcdef' }));
    expect(Object.keys(body)).not.toContain('clientPrivateKey');
  });

  it('sets both API and NAS addresses from the selected ZeroTier client', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
    const component = TestBed.runInInjectionContext(() => new RoutersComponent());
    component.vpnClients.set([{ id: '2', name: 'Cabang', vpnIp: '10.88.0.2' } as any]);
    component.form.vpnClientId = '2';
    component.onVpnClientChange();
    expect(component.form.ipAddress).toBe('10.88.0.2');
    expect(component.form.nasname).toBe('10.88.0.2');
  });

  it('removes the VPN server page and keeps VPN clients protected', () => {
    const children = routes.find(route => route.path === 'dashboard')!.children!;
    expect(children.some(route => route.path === 'router/vpn-server')).toBeFalse();
    expect(children.find(route => route.path === 'router/vpn-client')?.canActivate?.length).toBeGreaterThan(0);
  });
});

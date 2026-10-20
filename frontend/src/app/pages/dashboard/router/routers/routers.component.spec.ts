import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { RouterItem } from '../../../../shared/models/types';
import { RoutersComponent } from './routers.component';

describe('Router / NAS RADIUS setup', () => {
  const setupScript = { routerName: 'Lab', radiusServerIp: '10.255.0.1', nasSrcAddress: '10.255.0.2', authPort: 1812, coaPort: 3799, scriptRos7: '/radius add address=10.255.0.1', scriptRos6: '/radius add address=10.255.0.1' };
  function setup() {
    const api = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch']);
    api.get.and.returnValue(of({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 } }));
    api.post.and.returnValue(of({ message: 'NAS tersimpan', setup: setupScript }));
    api.patch.and.returnValue(of({ message: 'NAS tersimpan', setup: setupScript }));
    TestBed.configureTestingModule({ imports: [RoutersComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(RoutersComponent); fixture.detectChanges();
    return { api, fixture, component: fixture.componentInstance };
  }
  it('registers NAS without router management credentials and opens script automatically', () => {
    const { api, fixture, component } = setup();
    component.show(); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const name of ['username', 'password', 'port', 'authMode']) expect(element.querySelector(`[name="${name}"]`)).toBeNull();
    component.form.name = 'Lab'; component.form.nasname = '10.255.0.2';
    component.form.internetCidr = '192.168.75.1/24'; component.form.isolationCidr = '192.168.100.1/24';
    component.vpnClients.set([{ id: '11', name: 'Lab', username: 'vpn_lab', vpnIp: '10.88.0.2', isActive: true, provisionedAt: '2026-10-20', routers: [] }]);
    component.form.vpnClientId = '11'; component.selectVpn(); fixture.detectChanges();
    expect(element.querySelector('select[name="vpnClientId"]')).not.toBeNull();
    expect(element.querySelector('textarea[name="vpnCaCertificate"]')).toBeNull();
    expect((element.querySelector('input[name="nasname"]') as HTMLInputElement).readOnly).toBeTrue();
    expect(element.querySelector('input[name="internetCidr"]')).not.toBeNull();
    expect(element.querySelector('input[name="isolationCidr"]')).not.toBeNull();
    component.save(); fixture.detectChanges();
    const [url, body] = api.post.calls.mostRecent().args;
    expect(url).toBe('/router/nas');
    expect(body.coaPort).toBe(3799);
    expect(body.vpnClientId).toBe('11');
    expect(body.nasname).toBe('10.88.0.2');
    expect(body.radiusServerIp).toBe('10.88.0.1');
    expect(body.internetCidr).toBe('192.168.75.1/24'); expect(body.isolationCidr).toBe('192.168.100.1/24');
    expect(body.vpnPassword).toBeUndefined();
    for (const key of ['username', 'password', 'port', 'authMode']) expect(key in body).toBeFalse();
    expect(component.form.vpnPassword).toBe('');
    expect(body).not.toEqual(jasmine.objectContaining({ vpnCaCertificate: jasmine.anything() }));
    expect(component.scriptModalOpen()).toBeTrue();
    expect(element.textContent).toContain('NAS tersimpan. Pasang script');
    component.closeScript(); expect(component.scriptData()).toBeNull();
  });
  it('keeps editable NAS/Disconnect addresses and preserves the existing secret on edit', () => {
    const { api, fixture, component } = setup();
    component.show({ id: '7', name: 'Cabang', nasname: '10.255.0.2', ipAddress: '10.255.0.2', ports: 1812, coaPort: 3799, isActive: true } as RouterItem);
    fixture.detectChanges();
    for (const name of ['ipAddress', 'nasname']) expect(fixture.nativeElement.querySelector(`input[name="${name}"]`).readOnly).toBeFalse();
    expect(component.form.secret).toBe('');
    component.form.ipAddress = '10.255.0.3'; component.save();
    const [url, body] = api.patch.calls.mostRecent().args;
    expect(url).toBe('/router/nas/7'); expect(body.ipAddress).toBe('10.255.0.3'); expect(body.nasname).toBe('10.255.0.2');
    expect(body.secret).toBeUndefined();
    expect(api.get.calls.allArgs()).toEqual([['/router/nas?search=&page=1'], ['/router/vpn-clients'], ['/router/nas?search=&page=1']]);
  });
  it('renders VPN session status independently of NAS registration', () => {
    const { fixture, component } = setup();
    const statuses = ['online', 'offline', 'unknown', 'not_configured', undefined] as const;
    component.items.set(statuses.map((vpnStatus, index) => ({ id: String(index), name: 'Router', nasname: '10.88.0.2', isActive: true, vpnStatus } as RouterItem)));
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    expect(rows.map(row => row.children[3].textContent?.trim())).toEqual(['Online', 'Offline', 'Tidak diketahui', 'Tanpa VPN', 'Tidak diketahui']);
    const headers = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('th')).map(cell => cell.textContent);
    expect(headers).toContain('Status VPN');
    expect(headers).not.toContain('Pendaftaran NAS');
  });
  it('refreshes session status periodically and stops after leaving the page', fakeAsync(() => {
    const { fixture, api } = setup();
    expect(api.get).toHaveBeenCalledTimes(1);
    tick(15000);
    expect(api.get).toHaveBeenCalledTimes(2);
    fixture.destroy();
    tick(15000);
    expect(api.get).toHaveBeenCalledTimes(2);
  }));
  it('keeps prefixes on edit and requires installation confirmation from the script dialog', () => {
    const { fixture, component, api } = setup();
    const fingerprint = 'a'.repeat(64);
    api.patch.and.returnValue(of({ message: 'Disimpan', router: { id: '7' }, setup: { ...setupScript, networkFingerprint: fingerprint, networkNeedsConfirmation: true } }));
    component.show({ id: '7', name: 'Cabang', nasname: '10.88.0.2', isActive: true, internetCidr: '192.168.75.1/24', isolationCidr: '192.168.100.1/24' } as RouterItem);
    expect(component.form.internetCidr).toBe('192.168.75.1/24');
    component.save(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Konfirmasi Pemasangan');
    component.confirmNetwork(); expect(api.post).not.toHaveBeenCalled();
    component.scriptInstalled = true; component.confirmNetwork();
    expect(api.post).toHaveBeenCalledOnceWith('/router/nas/7/network/confirm', { fingerprint });
    expect(component.scriptData()?.networkNeedsConfirmation).toBeFalse();
  });
});

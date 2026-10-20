import { TestBed } from '@angular/core/testing';
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
    component.vpnClients.set([{ id: '11', name: 'Lab', username: 'vpn_lab', vpnIp: '10.88.0.2', isActive: true, provisionedAt: '2026-10-20', routers: [] }]);
    component.form.vpnClientId = '11'; component.selectVpn(); fixture.detectChanges();
    expect(element.querySelector('select[name="vpnClientId"]')).not.toBeNull();
    expect(element.querySelector('textarea[name="vpnCaCertificate"]')).toBeNull();
    expect((element.querySelector('input[name="nasname"]') as HTMLInputElement).readOnly).toBeTrue();
    component.save(); fixture.detectChanges();
    const [url, body] = api.post.calls.mostRecent().args;
    expect(url).toBe('/router/nas');
    expect(body.coaPort).toBe(3799);
    expect(body.vpnClientId).toBe('11');
    expect(body.nasname).toBe('10.88.0.2');
    expect(body.radiusServerIp).toBe('10.88.0.1');
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
});

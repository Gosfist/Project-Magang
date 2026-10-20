import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { VpnClientComponent } from './vpn-client.component';

describe('Klien VPN VPS', () => {
  function setup() {
    const api = jasmine.createSpyObj('ApiService', ['get', 'post']);
    api.get.and.callFake((url: string) => of(url.endsWith('/credentials') ? { password: 'test-only-password' } : {
      server: { host: '192.0.2.10', port: 4443 }, data: [
        { id: '3', name: 'Cabang', username: 'vpn_cabang', vpnIp: '10.88.0.2', isActive: true, provisionedAt: '2026-10-20', routers: [{ id: 7, name: 'MikroTik Cabang' }] },
        { id: '4', name: 'Baru', username: 'vpn_baru', vpnIp: '10.88.0.3', isActive: true, provisionedAt: null, routers: [] },
      ],
    }));
    api.post.and.returnValue(of({ message: 'Akun menunggu server' }));
    TestBed.configureTestingModule({ imports: [VpnClientComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(VpnClientComponent); fixture.detectChanges();
    return { api, fixture, component: fixture.componentInstance };
  }
  it('renders each requested column and row, distinguishing applied accounts from pending accounts', () => {
    const { fixture } = setup();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('th'), h => h.textContent?.trim())).toEqual(['No', 'Nama', 'Username', 'Password', 'IP VPN', 'Status', 'Router / NAS']);
    const rows = element.querySelectorAll('tbody tr');
    expect(Array.from(rows[0].querySelectorAll('td'), td => td.textContent?.trim())).toEqual(['1', 'Cabang', 'vpn_cabang', '••••••••Tampilkan', '10.88.0.2', 'Siap', 'MikroTik Cabang']);
    expect(rows[1].textContent).toContain('Menunggu server');
    expect(element.textContent).toContain('192.0.2.10:4443');
    fixture.destroy();
  });
  it('only requests the password when revealed and removes it when hidden', () => {
    const { api, fixture, component } = setup();
    expect(api.get.calls.count()).toBe(1);
    component.toggle(component.items()[0]); fixture.detectChanges();
    expect(api.get.calls.mostRecent().args[0]).toBe('/router/vpn-clients/3/credentials');
    expect(fixture.nativeElement.textContent).toContain('test-only-password');
    component.toggle(component.items()[0]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('test-only-password');
    fixture.destroy();
  });
  it('requests a generated password when blank and clears form secrets after creation', () => {
    const { api, fixture, component } = setup();
    component.show(); component.form.name = 'Baru'; component.form.username = 'vpn_baru'; component.save();
    expect(api.post.calls.mostRecent().args).toEqual(['/router/vpn-clients', { name: 'Baru', username: 'vpn_baru', password: undefined }]);
    expect(component.open()).toBeFalse(); expect(component.form.password).toBe('');
    fixture.destroy();
  });
});

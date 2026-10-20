import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { VpnClientComponent } from './vpn-client.component';

describe('Klien VPN VPS', () => {
  function setup() {
    const api = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    const response = {
      server: { host: '192.0.2.10', port: 4443 }, data: [
        { id: '3', name: 'Cabang', username: 'vpn_cabang', password: 'test-only-password', vpnIp: '10.88.0.2', isActive: true, provisionedAt: '2026-10-20', routers: [{ id: 7, name: 'MikroTik Cabang' }] },
        { id: '4', name: 'Baru', username: 'vpn_baru', password: 'another-password', vpnIp: '10.88.0.3', isActive: true, provisionedAt: null, routers: [] },
      ],
    };
    api.get.and.returnValue(of(response));
    api.post.and.returnValue(of({ message: 'Akun dibuat' }));
    api.patch.and.returnValue(of({ message: 'Perubahan disimpan' }));
    api.delete.and.returnValue(of({ message: 'Akun dihapus' }));
    TestBed.configureTestingModule({ imports: [VpnClientComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(VpnClientComponent); fixture.detectChanges();
    return { api, fixture, component: fixture.componentInstance, response };
  }

  it('shows plaintext passwords, icon actions and no status or reveal controls', () => {
    const { api, fixture } = setup();
    const element = fixture.nativeElement as HTMLElement;
    expect(api.get.calls.mostRecent().args[0]).toBe('/router/vpn-clients?credentials=1');
    expect(Array.from(element.querySelectorAll('th'), h => h.textContent?.trim())).toEqual(['No', 'Nama', 'Username', 'Password', 'IP VPN', 'Router / NAS', 'Aksi']);
    expect(Array.from(element.querySelector('tbody tr')!.querySelectorAll('td'), td => td.textContent?.trim())).toEqual(['1', 'Cabang', 'vpn_cabang', 'test-only-password', '10.88.0.2', 'MikroTik Cabang', '']);
    expect(element.querySelectorAll('tbody button svg').length).toBe(4);
    expect(element.textContent).not.toContain('Menunggu server');
    expect(element.textContent).not.toContain('Tampilkan');
    expect(element.textContent).not.toContain('Sembunyikan');
    fixture.destroy();
  });

  it('creates an account with generated password when blank and clears form secrets', () => {
    const { api, fixture, component } = setup();
    component.show(); component.form.name = 'Baru'; component.form.username = 'vpn_baru'; component.save();
    expect(api.post.calls.mostRecent().args).toEqual(['/router/vpn-clients', { name: 'Baru', username: 'vpn_baru', password: undefined }]);
    expect(component.open()).toBeFalse(); expect(component.form.password).toBe('');
    fixture.destroy();
  });

  it('opens edit from its icon and submits name, username and password to PATCH', () => {
    const { api, fixture, component } = setup();
    (fixture.nativeElement.querySelector('button[title="Edit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.form).toEqual({ name: 'Cabang', username: 'vpn_cabang', password: 'test-only-password' });
    expect(fixture.nativeElement.querySelector('#vpn-password').type).toBe('text');
    component.form = { name: 'Cabang baru', username: 'vpn_baru', password: 'new-password-123' };
    component.save();
    expect(api.patch.calls.mostRecent().args).toEqual(['/router/vpn-clients/3', { name: 'Cabang baru', username: 'vpn_baru', password: 'new-password-123' }]);
    expect(api.post).not.toHaveBeenCalled();
    expect(component.open()).toBeFalse();
    expect(component.form.password).toBe('');
    fixture.destroy();
  });

  it('omits blank password on edit and keeps the form open on server error', () => {
    const { api, fixture, component } = setup();
    component.show(component.items()[0]); component.form.password = '';
    api.patch.and.returnValue(throwError(() => new Error('Username sudah digunakan')));
    component.save();
    expect(api.patch.calls.mostRecent().args[1].password).toBeUndefined();
    expect(component.open()).toBeTrue();
    expect(component.saving()).toBeFalse();
    expect(component.toast()?.message).toBe('Username sudah digunakan');
    fixture.destroy();
  });

  it('requires delete confirmation and refreshes after success', () => {
    const { api, fixture, component } = setup();
    (fixture.nativeElement.querySelector('button[title="Hapus"]') as HTMLButtonElement).click();
    expect(api.delete).not.toHaveBeenCalled();
    component.cancelRemove(); component.confirmRemove();
    expect(api.delete).not.toHaveBeenCalled();
    component.remove(component.items()[1]); component.confirmRemove();
    expect(api.delete.calls.mostRecent().args[0]).toBe('/router/vpn-clients/4');
    expect(component.deleting()).toBeNull();
    expect(component.removing()).toBeFalse();
    expect(api.get.calls.count()).toBe(2);
    fixture.destroy();
  });

  it('shows linked NAS deletion errors and prevents duplicate submissions', () => {
    const { api, fixture, component } = setup();
    const pending = new Subject<{ message: string }>();
    api.delete.and.returnValue(pending);
    component.remove(component.items()[0]); component.confirmRemove(); component.confirmRemove(); component.cancelRemove();
    expect(api.delete.calls.count()).toBe(1);
    expect(component.deleting()).not.toBeNull();
    pending.error(new Error('Akun VPN masih dipakai Router / NAS'));
    expect(component.removing()).toBeFalse();
    expect(component.toast()?.message).toContain('masih dipakai');
    expect(component.items().length).toBe(2);
    fixture.destroy();
  });

  it('discards superseded password list responses and clears secrets on destroy', () => {
    const { api, fixture, component, response } = setup();
    const old = new Subject<typeof response>(), current = new Subject<typeof response>();
    api.get.and.returnValues(old, current);
    component.load(); component.load();
    const newest = { ...response, data: [{ ...response.data[0], password: 'current-password' }] };
    current.next(newest); old.next(response);
    expect(component.items()[0].password).toBe('current-password');
    component.show(component.items()[0]);
    fixture.destroy();
    expect(component.items()).toEqual([]);
    expect(component.form.password).toBe('');
    expect(component.editing()).toBeNull();
  });
});

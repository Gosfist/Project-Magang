import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { IpPool } from '../../../../shared/models/types';
import { IpPoolsComponent } from './ip-pools.component';

describe('Registered IP pool plans', () => {
  const pool: IpPool = { id: '12', routerNasId: 3, routerName: 'Lab', name: 'customers', networkStart: '10.0.0.2', networkEnd: '10.0.0.254', ranges: '10.0.0.2-10.0.0.254', totalIps: 253, usedIps: null, freeIps: null };
  function setup() {
    const api = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    api.get.and.callFake((url: string) => of(url === '/pppoe/nas/options' ? { data: [{ id: 3, nasname: '10.255.0.2', shortname: 'Lab' }] } : { data: [pool], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 1 } }));
    api.post.and.returnValue(of({ message: 'Rencana tersimpan', script: '/ip pool add name=customers' }));
    api.patch.and.returnValue(of({ message: 'NAS pool diperbarui', script: '/ip pool set [find where name=customers] ranges=10.0.0.2-10.0.0.254' }));
    api.delete.and.returnValue(of({ message: 'Rencana dihapus', script: '/ip pool remove [find where name=customers]' }));
    TestBed.configureTestingModule({ imports: [IpPoolsComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(IpPoolsComponent); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, api };
  }
  it('displays unmonitored capacity and opens the installation script after registering a pool', () => {
    const { fixture, component, api } = setup();
    expect(fixture.nativeElement.textContent.match(/Tidak dipantau/g).length).toBe(2);
    component.show(); component.form = { routerNasId: 3, name: pool.name, networkStart: pool.networkStart, networkEnd: pool.networkEnd };
    component.save(); fixture.detectChanges();
    expect(api.post).toHaveBeenCalledWith('/pppoe/ip-pools', component.form);
    expect(component.script()).toBe('/ip pool add name=customers');
    expect(fixture.nativeElement.textContent).toContain('Terminal Winbox router yang dipilih');
  });
  it('shows the scoped removal script after deleting only the registration', () => {
    const { fixture, component, api } = setup();
    spyOn(window, 'confirm').and.returnValue(true);
    component.remove(pool); fixture.detectChanges();
    expect(api.delete).toHaveBeenCalledWith('/pppoe/ip-pools/12');
    expect(component.script()).toBe('/ip pool remove [find where name=customers]');
    expect(fixture.nativeElement.textContent).toContain('/ip pool remove [find where name=customers]');
  });
  it('allows assigning a legacy pool to a NAS while keeping assigned pools on their owner', async () => {
    const { fixture, component, api } = setup();
    component.show({ ...pool, routerNasId: null }); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(component.form.routerNasId).toBe(0);
    expect(fixture.nativeElement.querySelector('select[name="routerNasId"]').disabled).toBeFalse();
    component.form.routerNasId = 3; component.save();
    expect(api.patch).toHaveBeenCalledWith('/pppoe/ip-pools/12', jasmine.objectContaining({ routerNasId: 3 }));
    component.show(pool); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[name="routerNasId"]').disabled).toBeTrue();
  });
  it('copies the displayed script from its button and resets feedback when closed', async () => {
    const { fixture, component } = setup();
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    component.script.set('/ip pool add name="Internet" ranges="192.168.75.1-192.168.75.254";');
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(item => item.textContent?.includes('Salin Script'))!;
    button.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(writeText).toHaveBeenCalledOnceWith(component.script());
    expect(button.textContent).toContain('Tersalin');
    component.closeScript();
    expect(component.copied()).toBeFalse(); expect(component.script()).toBeNull();
  });
  it('copies automatically through the fallback when Clipboard API is unavailable', async () => {
    const { component } = setup();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(undefined as unknown as Clipboard);
    const text = '/ip pool remove [find where name="Internet"];';
    component.script.set(text);
    const copy = spyOn(document, 'execCommand').and.callFake(command => {
      expect(command).toBe('copy');
      expect((document.querySelector('body > textarea') as HTMLTextAreaElement).value).toBe(text);
      return true;
    });
    await component.copyScript();
    expect(copy).toHaveBeenCalledOnceWith('copy');
    expect(component.copied()).toBeTrue();
    expect(document.querySelector('body > textarea')).toBeNull();
  });
  it('reports a clipboard failure without claiming the script was copied', async () => {
    const { component } = setup();
    const writeText = jasmine.createSpy('writeText').and.rejectWith(new Error('Denied'));
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    spyOn(document, 'execCommand').and.returnValue(false);
    component.script.set('/ip pool add name="Internet";');
    await component.copyScript();
    expect(component.copied()).toBeFalse();
    expect(component.toast()?.message).toContain('Script gagal disalin');
    expect(document.querySelector('body > textarea')).toBeNull();
  });
});

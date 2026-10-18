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
    api.patch.and.returnValue(of({ message: 'NAS pool diperbarui', script: '/ip pool add name=customers' }));
    api.delete.and.returnValue(of({ message: 'Rencana dihapus', script: '/ip pool remove $item' }));
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
    expect(component.script()).toBe('/ip pool remove $item');
    expect(fixture.nativeElement.textContent).toContain('/ip pool remove $item');
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
});

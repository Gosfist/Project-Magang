import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { IsolationComponent } from './isolation.component';

describe('PPPoE isolation manual setup', () => {
  const scriptFingerprint = 'a'.repeat(64);
  function setup() {
    const config = { enabled: false, poolName: '', subnet: '', localAddress: '' };
    const get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/router/nas/options'
      ? { data: [{ id: 3, displayName: 'Lab' }] }
      : url.endsWith('/status') ? { job: { status: 'completed', processed: 2, reconnected: 1, message: 'Done' } }
      : { config, ready: false, pools: [{ name: 'pool-isolir', ranges: '192.168.100.2-192.168.100.254' }], rules: [], script: '/ppp profile add name=isolir', job: null }));
    const post = jasmine.createSpy('post').and.callFake((_url: string, body: any) => of(body.scriptInstalled
      ? { message: 'RADIUS diperbarui', job: { status: 'running', processed: 0, reconnected: 0, message: '' } }
      : { message: 'Pasang script dahulu', script: '/ppp profile add name=isolir', scriptFingerprint, requiresConfirmation: true, config }));
    TestBed.configureTestingModule({ imports: [IsolationComponent], providers: [provideRouter([]), { provide: ApiService, useValue: { get, post } }] });
    const fixture = TestBed.createComponent(IsolationComponent); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, post, get };
  }
  it('loads registered pools without applying router changes or claiming live verification', () => {
    const { fixture, post } = setup();
    expect(fixture.nativeElement.querySelector('#isolation-pool').textContent).toContain('pool-isolir');
    expect(fixture.nativeElement.textContent).toContain('Konfigurasi perangkat: pemeriksaan manual');
    expect(post).not.toHaveBeenCalled();
  });
  it('requires explicit installation confirmation before activating the generated configuration', fakeAsync(() => {
    const { fixture, component, post, get } = setup();
    const config = { enabled: true, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1' };
    component.form = { ...config }; component.save();
    expect(post).toHaveBeenCalledWith('/pppoe/isolation/3', config);
    expect(component.scriptOpen()).toBeTrue(); expect(component.needsConfirmation()).toBeTrue();
    component.activate(); expect(post.calls.count()).toBe(1);
    component.form.poolName = 'changed-after-generation';
    component.scriptInstalled = true; component.activate();
    expect(post.calls.mostRecent().args).toEqual(['/pppoe/isolation/3', { ...config, scriptInstalled: true, scriptFingerprint }]);
    component.sync(); expect(post.calls.count()).toBe(2);
    tick(2000); expect(get).toHaveBeenCalledWith('/pppoe/isolation/3/status');
    const requests = get.calls.count(); tick(4000); expect(get.calls.count()).toBe(requests);
    fixture.destroy();
  }));
  it('discards the captured script fingerprint on close and on rejected confirmation', () => {
    const { component, post } = setup();
    component.form.enabled = true;
    component.save(); component.closeScript(); component.scriptInstalled = true; component.activate();
    expect(post.calls.count()).toBe(1);
    component.save();
    post.and.returnValue(throwError(() => new Error('Konfigurasi berubah. Buat script ulang.')));
    component.scriptInstalled = true; component.activate();
    expect(post.calls.count()).toBe(3);
    expect(component.scriptOpen()).toBeFalse();
    expect(component.toast()!.message).toContain('Buat script ulang');
    component.scriptInstalled = true; component.activate();
    expect(post.calls.count()).toBe(3);
  });
});

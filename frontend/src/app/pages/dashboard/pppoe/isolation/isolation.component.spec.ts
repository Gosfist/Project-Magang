import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { IsolationComponent } from './isolation.component';

describe('PPPoE isolation configuration', () => {
  function setup() {
    const config = { enabled: false, poolName: '', subnet: '', localAddress: '' };
    const get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/router/nas/options'
      ? { data: [{ id: 3, displayName: 'Lab' }] }
      : url.endsWith('/status') ? { job: { status: 'completed', processed: 2, reconnected: 1, message: 'Done' } }
      : { config, ready: false, pools: [{ name: 'pool-isolir', ranges: '192.168.100.2-192.168.100.254' }], rules: [], job: null }));
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Applied', job: { status: 'running', processed: 0, reconnected: 0, message: '' } }));
    TestBed.configureTestingModule({ imports: [IsolationComponent], providers: [provideRouter([]), { provide: ApiService, useValue: { get, post } }] });
    const fixture = TestBed.createComponent(IsolationComponent); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, post, get };
  }
  it('loads actual pools without applying anything on page open', () => {
    const { fixture, post } = setup();
    expect(fixture.nativeElement.querySelector('#isolation-pool').textContent).toContain('pool-isolir');
    expect(post).not.toHaveBeenCalled();
  });
  it('applies the selected NAS configuration and polls synchronization until completion', fakeAsync(() => {
    const { fixture, component, post, get } = setup();
    component.form = { enabled: true, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1' };
    component.save();
    expect(post).toHaveBeenCalledWith('/pppoe/isolation/3', component.form);
    component.sync(); expect(post.calls.count()).toBe(1);
    tick(2000);
    expect(get).toHaveBeenCalledWith('/pppoe/isolation/3/status');
    const requests = get.calls.count(); tick(4000);
    expect(get.calls.count()).toBe(requests);
    fixture.destroy();
  }));
});

import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataPelangganComponent } from './data-pelanggan.component';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('direct PPPoE customer registration', () => {
  function setup() {
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Tersimpan' }));
    TestBed.configureTestingModule({ imports: [DataPelangganComponent], providers: [
      { provide: ApiService, useValue: { get: () => of({ data: [], meta: null }), post } },
      { provide: AuthService, useValue: { isAdmin: () => true, isTeknisi: () => false } },
    ] });
    const fixture = TestBed.createComponent(DataPelangganComponent);
    const component = fixture.componentInstance;
    component.show();
    fixture.detectChanges();
    tick();
    return { fixture, component, post };
  }

  it('shows two steps and requires the service choice before opening PPPoE account fields', fakeAsync(() => {
    const { fixture, component, post } = setup();
    const host = fixture.nativeElement as HTMLElement;
    expect(Array.from(host.querySelectorAll('.step-label')).map(el => el.textContent?.trim())).toEqual(['Data Pelanggan', 'Data Akun PPPoE']);
    expect(host.textContent).not.toContain('Data Pembayaran');
    expect(host.querySelector('select[name="pppoePackageId"]')).not.toBeNull();
    for (const name of ['subscriptionType', 'billingDay', 'discount']) {
      expect(host.querySelector(`[name="${name}"]`)).toBeNull();
    }
    component.form = { ...component.form, customerName: 'Wisnu', phone: '08123456789', idCardNumber: '1234',
      idCardPhoto: 'id-cards/test.png', address: 'Alamat', areaId: '1' };
    const validForm = { reportValidity: () => true } as HTMLFormElement;
    component.nextStep(validForm);
    expect(component.step()).toBe(1);
    expect(post).not.toHaveBeenCalled();
    component.form.pppoePackageId = '1';
    component.nextStep(validForm);
    fixture.detectChanges();
    tick();
    expect(component.step()).toBe(2);
    expect(host.querySelector('input[name="username"]')).not.toBeNull();
    expect(host.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Simpan');
    component.prevStep();
    expect(component.step()).toBe(1);
    expect(component.form.pppoePackageId).toBe('1');
    discardPeriodicTasks();
  }));

  it('submits from the second step without sending manual payment or date settings', fakeAsync(() => {
    const { component, post } = setup();
    component.step.set(2);
    component.form = { ...component.form, customerName: 'Wisnu', phone: '08123456789', idCardNumber: '1234',
      idCardPhoto: 'id-cards/test.png', address: 'Alamat', areaId: '1', pppoePackageId: '2',
      username: 'wisnu', password: 'password123', odp: '4', routerNasId: '1' };
    component.submit({ reportValidity: () => true } as HTMLFormElement);
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.calls.mostRecent().args;
    expect(url).toBe('/pppoe/accounts');
    expect(body).toEqual(jasmine.objectContaining({ pppoePackageId: '2', username: 'wisnu', odp: '4', areaId: '1' }));
    for (const key of ['subscriptionType', 'billingDay', 'discount', 'firstInvoice', 'createdAt']) {
      expect(Object.prototype.hasOwnProperty.call(body, key)).toBeFalse();
    }
    expect(body.expiresAt).toBeUndefined();
    discardPeriodicTasks();
  }));
});

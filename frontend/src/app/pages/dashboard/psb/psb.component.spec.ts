import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PsbComponent } from './psb.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PsbOrder } from '../../../shared/models/types';

describe('technician PPPoE activation', () => {
  function setup(status = 'PROCESS') {
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Saved' }));
    TestBed.configureTestingModule({ imports: [PsbComponent], providers: [
      { provide: ApiService, useValue: { get: () => of({ data: [], meta: {} }), post } },
      { provide: AuthService, useValue: { hasRole: (...roles: string[]) => roles.includes('teknisi'), isSales: () => false } },
    ] });
    const fixture = TestBed.createComponent(PsbComponent);
    const component = fixture.componentInstance;
    component.openActivation({ id: '1', customerId: '000001', status } as PsbOrder);
    fixture.detectChanges();
    return { fixture, component, post };
  }

  it('binds manually typed credentials and sends them on save', () => {
    const { fixture, component, post } = setup();
    const username = fixture.nativeElement.querySelector('#activation-username') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#activation-password') as HTMLInputElement;
    expect(username.readOnly || username.disabled).toBeFalse();
    expect(password.readOnly || password.disabled).toBeFalse();
    username.value = 'andi.manual'; username.dispatchEvent(new Event('input'));
    password.value = 'manual123'; password.dispatchEvent(new Event('input'));
    component.activation.odp = '4';
    component.activation.installationPhoto = 'data:image/png;base64,test';
    component.activate();
    expect(post).toHaveBeenCalledWith('/psb/1/activate', jasmine.objectContaining({ username: 'andi.manual', password: 'manual123' }));
  });

  it('saves a username change on an activated account without resetting its password', () => {
    const { component, post } = setup('ACTIVATED');
    component.activation = { username: 'new.username', password: '', odp: '4', installationPhoto: '/uploads/instalasi/1.png' };
    component.activate();
    expect(post).toHaveBeenCalledWith('/psb/1/activate', jasmine.objectContaining({ username: 'new.username', password: undefined }));
  });
  it('renders unknown accounting separately from offline and uses Online for a live session', () => {
    const { fixture, component } = setup();
    component.activationOpen.set(false);
    component.items.set([true, false, null].map((internetOnline, index) => ({ id: String(index), customerId: String(index).padStart(6, '0'),
      customerName: 'Pelanggan uji', phone: '-', address: '-', package: { name: '20 Mb' }, createdAt: '2026-10-20T00:00:00Z',
      status: 'ACTIVATED', internetOnline } as PsbOrder)));
    fixture.detectChanges();
    const badges = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr td:nth-child(8) span'));
    expect(badges.map(badge => badge.textContent?.trim())).toEqual(['Online', 'Offline', 'Belum diketahui']);
    expect(badges[2].className).toContain('bg-slate-100');
    expect(badges[2].getAttribute('title')).toContain('accounting RADIUS');
  });
});

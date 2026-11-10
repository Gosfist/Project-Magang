import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { PsbComponent } from './psb.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PsbOrder } from '../../../shared/models/types';

describe('technician PPPoE activation', () => {
  function setup(status = 'PROCESS') {
    const option = { id: '4', namaTitik: 'ODP Uji', tipeTitik: 'odp' as const, alamat: null, routerNasId: 3, routerName: 'Router Uji',
      ports: [{ number: 1, used: false, accountId: null }, { number: 2, used: true, accountId: '9' }, { number: 3, used: true, accountId: null }] };
    const photoRequests: Record<string, Subject<Blob>> = {};
    const getBlob = (path: string) => { const request = new Subject<Blob>(); photoRequests[path] = request; return request; };
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Saved' }));
    TestBed.configureTestingModule({ imports: [PsbComponent], providers: [
      { provide: ApiService, useValue: { get: (path: string) => of({ data: path === '/pppoe/odp/options' ? [option] : [], meta: {} }), getBlob, post } },
      { provide: AuthService, useValue: { hasRole: (...roles: string[]) => roles.includes('teknisi'), isSales: () => false } },
    ] });
    const fixture = TestBed.createComponent(PsbComponent);
    const component = fixture.componentInstance;
    component.openActivation({ id: '1', customerId: '000001', status } as PsbOrder);
    component.odps.set([option]);
    fixture.detectChanges();
    return { fixture, component, post, photoRequests };
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
    component.activation.odpPort = '1';
    component.activation.installationPhoto = 'data:image/png;base64,test';
    component.activate();
    expect(post).toHaveBeenCalledWith('/psb/1/activate', jasmine.objectContaining({ username: 'andi.manual', password: 'manual123' }));
  });

  it('saves a username change on an activated account without resetting its password', () => {
    const { component, post } = setup('ACTIVATED');
    component.activation = { username: 'new.username', password: '', odp: '4', odpPort: '1', installationPhoto: '/uploads/instalasi/1.png' };
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
  it('shows every port and disables occupied outputs while keeping the current account port selectable', () => {
    const { fixture, component, post } = setup();
    const buttons = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    buttons().find(button => button.textContent?.includes('Pilih ODC / ODP'))!.click();
    fixture.detectChanges();
    buttons().find(button => button.textContent?.includes('ODP Uji'))!.click();
    fixture.detectChanges();
    expect(component.activation.odp).toBe('4');
    expect(component.activationPorts().length).toBe(3);
    const select = fixture.nativeElement.querySelector('#activation-odp-port') as HTMLSelectElement;
    expect([...select.options].map(option => option.textContent?.trim())).toEqual(['Pilih port', 'Port 1', 'Port 2 (terpakai)', 'Port 3 (terpakai)']);
    expect(select.options[2].disabled).toBeTrue();
    expect(select.options[3].disabled).toBeTrue();
    component.activation.odpPort = '2';
    component.activate();
    expect(post).not.toHaveBeenCalled();
    component.selected.set({ ...component.selected()!, pppoeAccountId: '9' });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(select.options[2].disabled).toBeFalse();
    expect(select.options[3].disabled).toBeTrue();
    component.selectOdp({ id: '5' } as any);
    expect(component.activation.odpPort).toBe('');
  });

  it('ignores an old photo response after another customer activation is opened', () => {
    const { component, photoRequests } = setup();
    const read = spyOn(FileReader.prototype, 'readAsDataURL').and.callFake(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/png;base64,Yg==' });
      this.onload?.call(this, new ProgressEvent('load') as ProgressEvent<FileReader>);
    });
    component.openActivation({ id: '1', customerId: '000001', status: 'ACTIVATED', installationPhoto: '/uploads/instalasi/1.png' } as PsbOrder);
    component.openActivation({ id: '2', customerId: '000002', status: 'ACTIVATED', installationPhoto: '/uploads/instalasi/2.png' } as PsbOrder);
    photoRequests['/psb/1/installation-photo'].next(new Blob(['old']));
    expect(read).not.toHaveBeenCalled();
    expect(component.activation.installationPhoto).toBe('/uploads/instalasi/2.png');
    photoRequests['/psb/2/installation-photo'].next(new Blob(['current']));
    expect(component.activation.installationPhoto).toBe('data:image/png;base64,Yg==');
  });
  it('returns to port selection after a normalized API port conflict', () => {
    const { component } = setup();
    component.activationStep.set(2);
    component.activation.odp = '4'; component.activation.odpPort = '1';
    component.activation.installationPhoto = 'data:image/png;base64,Yg==';
    const api = TestBed.inject(ApiService);
    (api.post as jasmine.Spy).and.returnValue(throwError(() => new Error('Port sudah terpakai.')));
    component.activate();
    expect(component.activationStep()).toBe(1);
  });

});

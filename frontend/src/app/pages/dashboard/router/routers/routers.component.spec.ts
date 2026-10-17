import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { RouterItem } from '../../../../shared/models/types';
import { RoutersComponent } from './routers.component';

describe('Router / NAS without VPN client selection', () => {
  it('loads only NAS data and keeps saved addresses editable', async () => {
    const api = jasmine.createSpyObj('ApiService', ['get', 'patch']);
    api.get.and.returnValue(of({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 } }));
    api.patch.and.returnValue(of({ message: 'Tersimpan' }));
    await TestBed.configureTestingModule({
      imports: [RoutersComponent], providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(RoutersComponent);
    fixture.detectChanges();
    expect(api.get.calls.allArgs()).toEqual([['/router/nas?search=&page=1']]);
    fixture.componentInstance.show({
      id: '7', name: 'Router cabang', nasname: '10.88.0.3', ipAddress: '10.88.0.3',
      secret: 'test-only-secret', port: 8728, ports: 1812, isActive: true,
    } as RouterItem);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const name of ['ipAddress', 'nasname']) {
      expect(element.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.readOnly).toBeFalse();
    }
    fixture.componentInstance.form.ipAddress = '10.88.0.4';
    fixture.componentInstance.save();
    const [url, body] = api.patch.calls.mostRecent().args;
    expect(url).toBe('/router/nas/7');
    expect(body.ipAddress).toBe('10.88.0.4');
    expect(body.nasname).toBe('10.88.0.3');
    expect(body.vpnClientId).toBeUndefined();
  });
});

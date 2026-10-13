import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { BackupComponent } from './backup.component';
import { PengaturanComponent } from '../pengaturan/pengaturan.component';

describe('Settings PPPoE backup', () => {
  function setup(parent = false) {
    const post = jasmine.createSpy('post').and.callFake((url: string) => of(url.endsWith('/preview')
      ? { total: 1, create: 1, update: 0, token: 'review-ticket', errors: [], rows: [{ row: 2, customerNumber: '000123', customerName: 'Contoh', username: 'customer', packageName: '10M', routerName: 'Lab', action: 'Tambah' }] }
      : { message: 'Imported' }));
    const patch = jasmine.createSpy('patch').and.returnValue(of({ message: 'Saved', settings: { localAddress: '192.168.75.1', baseProfile: 'default' } }));
    const get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/settings/backup/options' ? { routers: [{ id: 3, name: 'Lab', count: 2, isActive: false, settings: { localAddress: '192.168.75.1', baseProfile: 'default' } }], unassigned: 1 } : {}));
    const postBlob = jasmine.createSpy('postBlob').and.returnValue(of(new Blob(['test'])));
    const getBlob = jasmine.createSpy('getBlob').and.returnValue(of(new Blob(['test'])));
    TestBed.configureTestingModule({ imports: [BackupComponent, PengaturanComponent], providers: [{ provide: ApiService, useValue: { get, post, patch, postBlob, getBlob } }] });
    const fixture = parent ? TestBed.createComponent(PengaturanComponent) : TestBed.createComponent(BackupComponent); fixture.detectChanges();
    return { fixture, post, postBlob, getBlob, get, patch };
  }
  it('opens Backup inside Settings and does not write to the router or import on load', () => {
    const { fixture, post, get } = setup(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('nav button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === 'Backup')!.click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Script Darurat per Router');
    expect(get).toHaveBeenCalledWith('/settings/backup/options'); expect(post).not.toHaveBeenCalled();
  });
  it('invalidates preview when file or mode changes and requires a valid preview before import', () => {
    const { fixture, post } = setup(); const component = fixture.componentInstance as BackupComponent;
    component.file = new File(['sample'], 'backup.xlsx'); component.importFile(); expect(post).not.toHaveBeenCalled();
    component.checkFile(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('000123');
    component.importFile();
    const args = post.calls.mostRecent().args; expect(args[0]).toBe('/settings/backup/import');
    expect((args[1] as FormData).get('token')).toBe('review-ticket');
    component.preview.set({ total: 1, create: 0, update: 0, token: null, errors: [{ row: 2, message: 'Duplikat' }], rows: [] });
    const count = post.calls.count(); component.importFile(); expect(post.calls.count()).toBe(count);
    component.chooseFile({ target: { files: [new File(['sample'], 'other.xlsx')] } } as unknown as Event); expect(component.preview()).toBeNull();
  });
  it('refuses a local-script download with unsaved gateway changes', () => {
    const { fixture, postBlob } = setup(); const component = fixture.componentInstance as BackupComponent;
    expect(component.settingsSaved()).toBeTrue(); component.settings.localAddress = '192.168.99.1';
    component.downloadScript('local'); expect(postBlob).not.toHaveBeenCalled();
    expect(component.toast()?.message).toContain('Simpan pengaturan');
  });
});

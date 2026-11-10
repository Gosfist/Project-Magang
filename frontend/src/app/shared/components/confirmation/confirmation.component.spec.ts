import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { NavigationStart, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { OdcComponent } from '../../../pages/dashboard/main-core/odc/odc.component';
import { MainCoreNode } from '../../models/types';
import { ConfirmationComponent } from './confirmation.component';
import { AppComponent } from '../../../app.component';
import { AuthService } from '../../../core/services/auth.service';

describe('Application deletion confirmation', () => {
  function setup() {
    const events = new Subject<NavigationStart>();
    const api = jasmine.createSpyObj('ApiService', ['delete', 'get']);
    api.delete.and.returnValue(of({ message: 'Berhasil dihapus' }));
    api.get.and.returnValue(of({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 5, total: 0 } }));
    TestBed.configureTestingModule({ imports: [ConfirmationComponent], providers: [
      { provide: ApiService, useValue: api }, { provide: Router, useValue: { events } },
    ] });
    const fixture = TestBed.createComponent(ConfirmationComponent);
    const odc = TestBed.runInInjectionContext(() => new OdcComponent());
    const node = { id: '12', namaTitik: 'odc 1' } as MainCoreNode;
    const confirmation = TestBed.inject(ConfirmationService);
    const button = (text: string): HTMLButtonElement =>
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(item => item.textContent?.trim() === text)!;
    fixture.detectChanges();
    return { fixture, odc, node, confirmation, api, events, button };
  }

  it('shows the shared VPN-style modal and deletes ODC only after Hapus', async () => {
    const { fixture, odc, node, api, button } = setup();
    const native = spyOn(window, 'confirm').and.returnValue(false);
    const pending = odc.remove(node);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Hapus ODC');
    expect(fixture.nativeElement.textContent).toContain('Hapus odc 1?');
    expect(api.delete).not.toHaveBeenCalled();
    button('Hapus').click();
    button('Hapus').click();
    await pending;
    fixture.detectChanges();
    expect(api.delete).toHaveBeenCalledOnceWith('/main-core/odc/12');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(native).not.toHaveBeenCalled();
  });

  for (const action of ['Batal', 'close', 'backdrop', 'Escape']) {
    it(`does not delete when dismissed using ${action}`, async () => {
      const { fixture, odc, node, api, button } = setup();
      const pending = odc.remove(node);
      fixture.detectChanges();
      if (action === 'Batal') button('Batal').click();
      else if (action === 'close') fixture.nativeElement.querySelector('[aria-label="Tutup dialog"]').click();
      else if (action === 'backdrop') fixture.nativeElement.querySelector('app-modal > div').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await pending;
      fixture.detectChanges();
      expect(api.delete).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    });
  }

  it('ignores repeated delete clicks and cancels on navigation', async () => {
    const { fixture, odc, node, api, events, confirmation } = setup();
    const pending = odc.remove(node);
    await odc.remove({ ...node, id: '13', namaTitik: 'odc 2' });
    expect(confirmation.current()?.message).toBe('Hapus odc 1?');
    fixture.detectChanges();
    events.next(new NavigationStart(1, '/dashboard'));
    await pending;
    expect(api.delete).not.toHaveBeenCalled();
    expect(confirmation.current()).toBeNull();
  });

  it('focuses Batal, traps keyboard focus, and restores the opener after closing', async () => {
    const { fixture, confirmation, button } = setup();
    const opener = document.createElement('button');
    document.body.append(opener);
    try {
      opener.focus();
      const pending = confirmation.ask('Hapus ODC', 'Hapus odc 1?');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(button('Batal'));
      button('Hapus').focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[aria-label="Tutup dialog"]'));
      button('Batal').click();
      expect(await pending).toBeFalse();
      expect(document.activeElement).toBe(opener);
    } finally {
      opener.remove();
    }
  });
});

describe('Root confirmation host', () => {
  it('loads the shared dialog on demand and resolves the original decision', async () => {
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [
      provideRouter([]), { provide: AuthService, useValue: { loadUser() {} } },
    ], deferBlockBehavior: DeferBlockBehavior.Playthrough });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-confirmation')).toBeNull();
    const confirmation = TestBed.inject(ConfirmationService);
    const pending = confirmation.ask('Hapus ODC', 'Hapus odc 1?');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Hapus odc 1?');
    fixture.nativeElement.querySelector('.btn-secondary').click();
    expect(await pending).toBeFalse();
  });
});

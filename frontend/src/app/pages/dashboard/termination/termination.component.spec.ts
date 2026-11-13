import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TerminationComponent } from './termination.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
const meta = { currentPage: 1, lastPage: 1, perPage: 10, total: 1 };
const item = {
  id: '1',
  reason: 'Pindah rumah',
  requestedByName: 'Admin',
  requestedAt: '2026-11-13T02:00:00Z',
  collectedByName: null,
  completedAt: null,
  collectedAmount: '0',
  waSentAt: null,
  account: {
    id: '7',
    customerName: 'Paijo',
    customerNumber: '7',
    address: 'Jl. Diponegoro',
    phone: '08123',
    package: { name: '50 Mb' },
  },
};
describe('Berhenti Langganan', () => {
  function setup(admin = false) {
    const api = {
      get: jasmine
        .createSpy('get')
        .and.callFake((url: string) =>
          of(
            url.endsWith('/summary')
              ? { total: 30000, customerName: 'Paijo', invoices: [] }
              : { data: [item], meta },
          ),
        ),
      post: jasmine
        .createSpy('post')
        .and.returnValue(of({ message: 'Selesai', warnings: [] })),
    };
    TestBed.configureTestingModule({
      imports: [TerminationComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: { isAdmin: () => admin } },
      ],
    });
    const fixture = TestBed.createComponent(TerminationComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      api,
      host: fixture.nativeElement as HTMLElement,
    };
  }
  it('defaults to uncollected and lets technicians finish any customer without Add/Delete actions', () => {
    const { component, api, host } = setup();
    expect(component.status).toBe('PENDING');
    expect(api.get.calls.first().args[0]).toContain('status=PENDING');
    const buttons = Array.from(host.querySelectorAll('button')).map((el) =>
      el.textContent?.trim(),
    );
    expect(buttons).toContain('Selesai');
    expect(buttons).not.toContain('Tambah');
    expect(host.textContent).not.toContain('Hapus');
  });
  it('closes the dialog with Escape and restores trigger focus', () => {
    const { component, fixture, host } = setup(true);
    const trigger = Array.from(host.querySelectorAll('button')).find(el => el.textContent?.trim() === 'Tambah')!;
    trigger.focus(); component.add(); fixture.detectChanges();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    component.dialogKeys(new KeyboardEvent('keydown', { key: 'Escape' })); fixture.detectChanges();
    expect(component.adding()).toBeFalse();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('only shows Add for admin', () => {
    const { host } = setup(true);
    expect(
      Array.from(host.querySelectorAll('button')).some(
        (el) => el.textContent?.trim() === 'Tambah',
      ),
    ).toBeTrue();
  });
  it('requires confirmation of cash and equipment before completing', () => {
    const { component, api } = setup();
    component.openCompletion(item);
    component.complete();
    expect(api.post).not.toHaveBeenCalled();
    component.confirmed = true;
    component.complete();
    expect(api.post).toHaveBeenCalledWith('/pppoe/terminations/1/complete', {
      amount: 30000,
    });
    expect(component.selected()).toBeNull();
  });
  it('blocks double submit while completion is in progress', () => {
    const { component, api } = setup();
    const response = new Subject();
    api.post.and.returnValue(response);
    component.openCompletion(item);
    component.confirmed = true;
    component.complete();
    component.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(component.saving()).toBeTrue();
    component.closeCompletion();
    expect(component.selected()).not.toBeNull();
    response.complete();
  });
  it('displays the real collection officer in the completed list', () => {
    const { fixture, component, host } = setup();
    component.status = 'COMPLETED';
    component.items.set([
      {
        ...item,
        collectedByName: 'Teknisi Budi',
        completedAt: '2026-11-13T02:00:00Z',
        collectedAmount: '30000',
        waSentAt: '2026-11-13T02:00:00Z',
      },
    ]);
    fixture.detectChanges();
    expect(host.textContent).toContain('Teknisi Budi');
    expect(host.textContent).toContain('WA terkirim');
  });
});

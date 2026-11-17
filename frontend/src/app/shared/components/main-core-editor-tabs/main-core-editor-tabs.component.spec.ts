import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { MainCoreEditorTabsComponent } from './main-core-editor-tabs.component';

@Component({
  standalone: true,
  imports: [MainCoreEditorTabsComponent],
  template: `@if (open) { <app-main-core-editor-tabs nodeId="1" category="odc" label="ODC"><input aria-label="Nama ODC" value="ODC awal" /></app-main-core-editor-tabs> }`,
})
class HostComponent { open = true; }

describe('Main Core editor tabs', () => {
  let api: jasmine.SpyObj<ApiService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('ApiService', ['get']);
    api.get.and.returnValue(of({ data: [
      { port: 1, destinations: [{ id: '2', name: 'Utara', type: 'odp' }], customers: [] },
      { port: 2, destinations: [], customers: [{ id: '10', customerNumber: '000045', name: 'Ahmad', online: true }] },
      { port: 3, destinations: [], customers: [] },
    ], warnings: [] }));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });

  it('opens Data by default, preserves form edits across tabs and resets on reopen', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-tab="data"]')?.getAttribute('aria-selected')).toBe('true');
    expect(api.get).not.toHaveBeenCalled();
    const input = root.querySelector('input')!;
    input.value = 'ODC diperbarui';
    (root.querySelector('[data-tab="output"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('#odc-data-panel')?.hasAttribute('hidden')).toBeTrue();
    expect(root.textContent).toContain('To ODP_Utara');
    expect(root.textContent).toContain('Ahmad');
    expect(root.textContent).toContain('000045');
    expect(root.textContent).toContain('Online');
    expect(root.textContent).toContain('Belum terpakai');
    expect(api.get).toHaveBeenCalledWith('/main-core/odc/1/output');
    (root.querySelector('[data-tab="data"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('input')).toBe(input);
    expect(input.value).toBe('ODC diperbarui');
    fixture.componentInstance.open = false;
    fixture.detectChanges();
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    expect(root.querySelector('[data-tab="data"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('supports keyboard tab navigation and announces selection', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('[data-tab="data"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-tab="output"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-tab="data"]')?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows a recoverable error without displaying stale output as current', () => {
    api.get.and.returnValue(throwError(() => new Error('Network error')));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-tab="output"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Output gagal dimuat');
    expect((Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes('Muat ulang'))!).disabled).toBeFalse();
  });
});

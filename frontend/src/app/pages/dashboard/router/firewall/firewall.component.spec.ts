import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { FirewallComponent } from './firewall.component';

describe('Firewall MikroTik web editor', () => {
  function setup() {
    const row = { '.id': '*A', chain: 'forward', action: 'drop', 'connection-state': 'established,related', comment: 'customer', bytes: '100', packets: '2' };
    const get = jasmine.createSpy('get').and.callFake((url: string) => of(url === '/router/nas/options' ? { data: [{ id: 3, displayName: 'Lab' }] } : { data: [row, { '.id': '*B', comment: 'UNZANET-ISOLIR:3:OUT', action: 'drop' }] }));
    const patch = jasmine.createSpy('patch').and.returnValue(of({ message: 'Saved' }));
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Saved' }));
    TestBed.configureTestingModule({ imports: [FirewallComponent], providers: [provideRouter([]), { provide: ApiService, useValue: { get, patch, post } }] });
    const fixture = TestBed.createComponent(FirewallComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, row, get, patch, post };
  }
  it('renders all tables and protects isolation rules from generic actions', () => {
    const { fixture } = setup();
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.map(tab => tab.textContent?.trim())).toEqual(['Filter', 'NAT', 'Mangle', 'Raw', 'Address List']);
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('button').length).toBe(4);
    expect(rows[1].querySelectorAll('button').length).toBe(0);
  });
  it('saves a typed comment by stable ID while preserving advanced matchers and excluding counters', async () => {
    const { fixture, component, row, patch } = setup();
    component.show(row); fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[aria-label="comment"]') as HTMLInputElement;
    input.value = 'manual edit'; input.dispatchEvent(new Event('input'));
    component.save();
    expect(patch).toHaveBeenCalledWith('/router/firewall/3/ip/filter/*A', { fields: {
      chain: 'forward', action: 'drop', 'connection-state': 'established,related', comment: 'manual edit',
    } });
  });
  it('closes stale edits when changing the router or table', () => {
    const { component, row, get } = setup();
    component.show(row); component.routerId = 4; component.table = 'nat'; component.load();
    expect(component.editorOpen()).toBeFalse(); expect(component.editing).toBeNull();
    expect(get).toHaveBeenCalledWith('/router/firewall/4/ip/nat');
  });
  it('keeps the original RouterOS row number when searching', () => {
    const { component } = setup();
    component.search = 'UNZANET';
    expect(component.rowNumber(component.visible()[0])).toBe(1);
  });
});

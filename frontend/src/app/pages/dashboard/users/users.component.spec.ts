import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UsersComponent } from './users.component';
import { ApiService } from '../../../core/services/api.service';

describe('Account access checkboxes', () => {
  it('locks the primary role and persists additional checkbox selections', () => {
    const post = jasmine.createSpy('post').and.returnValue(of({ message: 'Saved' }));
    TestBed.configureTestingModule({ imports: [UsersComponent], providers: [
      { provide: ApiService, useValue: { get: () => of({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 15, total: 0 } }), post } },
    ] });
    const fixture = TestBed.createComponent(UsersComponent);
    const component = fixture.componentInstance;
    component.show(); component.form.role = 'finance';
    fixture.detectChanges();
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBe(4);
    expect(checkboxes[2].checked).toBeTrue();
    expect(checkboxes[2].disabled).toBeTrue();
    expect(checkboxes[0].disabled).toBeFalse();
    checkboxes[0].click(); checkboxes[1].click();
    expect(component.form.additionalRoles).toEqual(['sales', 'kolektor']);
    component.save();
    expect(post).toHaveBeenCalledWith('/users', jasmine.objectContaining({ role: 'finance', additionalRoles: ['sales', 'kolektor'] }));
  });

  it('checks and locks all permissions for Administrator', () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
    const component = TestBed.runInInjectionContext(() => new UsersComponent());
    component.form.role = 'admin';
    expect(component.accessOptions.every(role => component.accessChecked(role))).toBeTrue();
    component.toggleAccess('sales', { target: { checked: false } } as unknown as Event);
    expect(component.accessChecked('sales')).toBeTrue();
  });
});

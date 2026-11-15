import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { FinanceSalaryComponent } from './finance-salary.component';
import { PayrollRow } from '../../../../shared/models/payroll';
describe('Finance salary and attendance', () => {
  function setup() {
    const row: PayrollRow = { user: {id:'7',name:'Teknisi A',role:'teknisi',status:'active'},profile:null,base:1000000,presentDays:3,leaveDays:2,excessDays:0,lateDays:1,earlyDays:1,leaveCut:0,lateCut:10000,earlyCut:50000,deduction:60000,netWage:940000,psbBonus:33334,salesSalary:0,total:973334 };
    const get = jasmine.createSpy('get').and.callFake((path: string) => of(path.startsWith('/finance/payroll/policy') ? {checkInStart:'08:00',lateAfter:'08:15',checkOutTime:'17:00',autoCheckoutTime:'17:15'} : path.startsWith('/finance/payroll/attendance') ? {data:[],total:0,leaves:[]} : path.startsWith('/finance/payroll?') ? {data:[row],total:973334,month:'2026-11'} : {psb:100000,sales:50000}));
    const post = jasmine.createSpy('post').and.returnValue(of({message:'Disimpan'}));
    const patch = jasmine.createSpy('patch').and.returnValue(of({message:'Disimpan'}));
    TestBed.configureTestingModule({imports:[FinanceSalaryComponent],providers:[{provide:ApiService,useValue:{get,post,patch}}]});
    const fixture=TestBed.createComponent(FinanceSalaryComponent);fixture.detectChanges();return {fixture,component:fixture.componentInstance,row,post,patch,get};
  }
  it('defaults the attendance input and API filter to today in WIB across the UTC date boundary', async () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-11-14T17:30:00Z'));
      const {fixture,component,get}=setup();component.tab.set('attendance');fixture.detectChanges();await fixture.whenStable();
      expect(component.leave.date).toBe('2026-11-15');
      expect(fixture.nativeElement.querySelector('#leave-date').value).toBe('2026-11-15');
      expect(component.attendanceDate).toBe('2026-11-15');
      expect(fixture.nativeElement.querySelector('#attendance-date').value).toBe('2026-11-15');
      expect(get).toHaveBeenCalledWith('/finance/payroll/attendance?month=2026-11&date=2026-11-15&userId=');
      component.month='2026-10';component.changeMonth();expect(component.attendanceDate).toBe('');
      component.month='2026-11';component.changeMonth();expect(component.attendanceDate).toBe('2026-11-15');fixture.destroy();
    } finally { jasmine.clock().uninstall(); }
  });
  it('shows the total wage including each PSB share and itemizes deductions', () => {
    const {fixture}=setup();const text=fixture.nativeElement.textContent;
    expect(text).toContain('Rp 973.334');expect(text).toContain('Rp 33.334');expect(text).toContain('Pulang awal Rp 50.000');expect(text).not.toContain(' ? ');expect(text).toContain('teknisi / active');fixture.destroy();
  });
  it('clears the old payroll total when a different period cannot be loaded', () => {
    const {fixture,component,get}=setup();get.and.returnValue(throwError(()=>new Error('offline')));component.month='2026-10';component.load();fixture.detectChanges();expect(component.report()).toBeNull();expect(fixture.nativeElement.textContent).not.toContain('Rp 973.334');fixture.destroy();
  });
  it('saves per-account salary settings for the selected month without replacing other accounts', () => {
    const {fixture,component,row,post}=setup();component.month='2026-11';component.edit(row);component.profile.salaryType='DAILY';component.profile.amount=100000;component.profile.lateCut=false;component.saveProfile();
    expect(post).toHaveBeenCalledWith('/finance/payroll/profiles',jasmine.objectContaining({userId:'7',effectiveFrom:'2026-11-01',salaryType:'DAILY',amount:100000,lateCut:false}));fixture.destroy();
  });
  it('keeps attendance policy and leave recording in the same salary page', () => {
    const {fixture,component}=setup();component.tab.set('policy');fixture.detectChanges();expect(fixture.nativeElement.querySelector('#auto-checkout')).toBeTruthy();expect(fixture.nativeElement.querySelector('#workdays')).toBeNull();
    component.tab.set('attendance');fixture.detectChanges();expect(fixture.nativeElement.querySelector('#leave-user')).toBeTruthy();expect(fixture.nativeElement.textContent).toContain('Belum ada absensi.');fixture.destroy();
  });
});

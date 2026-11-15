import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TechnicianAttendanceComponent } from './technician-attendance.component';
describe('Technician attendance', () => {
  function setup(checkIn = false, checkOut = false) {
    const today={today:'2026-11-15',policy:{checkInStart:'08:00',lateAfter:'08:15',checkOutTime:'17:00',autoCheckoutTime:'17:15'},attendance:null,leave:null,canCheckIn:checkIn,canCheckOut:checkOut};
    const get=jasmine.createSpy('get').and.callFake((p:string)=>of(p.endsWith('/salary')?{data:[]}:today));
    const post=jasmine.createSpy('post').and.returnValue(of({message:'Tercatat'}));
    TestBed.configureTestingModule({imports:[TechnicianAttendanceComponent],providers:[{provide:ApiService,useValue:{get,post}}]});const fixture=TestBed.createComponent(TechnicianAttendanceComponent);fixture.detectChanges();return{fixture,component:fixture.componentInstance,get,post};
  }
  it('disables check-in before the server says attendance is open',()=>{
    const{fixture,post}=setup();const buttons=[...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];const button=buttons.find(b=>b.textContent?.includes('Absen Masuk'))!;expect(button.disabled).toBeTrue();button.click();expect(post).not.toHaveBeenCalled();fixture.destroy();
  });
  it('allows early checkout and suppresses duplicate requests',()=>{
    const{fixture,component,post}=setup(false,true);const pending=new Subject<{message:string}>();post.and.returnValue(pending);component.submit('check-out');component.submit('check-out');expect(post.calls.count()).toBe(1);expect(post.calls.mostRecent().args).toEqual(['/employee/attendance/check-out',{}]);pending.next({message:'Tercatat'});pending.complete();expect(component.busy()).toBeFalse();fixture.destroy();
  });
  it('keeps server rejection visible rather than hiding it during refresh',()=>{
    const{fixture,component,post}=setup(true);post.and.returnValue(throwError(()=>new Error('Belum waktunya absen')));component.submit('check-in');fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Belum waktunya absen');fixture.destroy();
  });
});

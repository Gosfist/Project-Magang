import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login.component';

describe('Login feedback after asynchronous authentication', () => {
  it('shows a failed login and restores the button without another user interaction', async () => {
    let rejectLogin!: (error: Error) => void;
    const login = jasmine.createSpy('login').and.returnValue(new Promise<void>((_, reject) => { rejectLogin = reject; }));
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]),
      { provide: AuthService, useValue: { user: signal(null), login } },
    ] });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.autoDetectChanges();
    fixture.componentInstance.email = ' teknisi@example.test ';
    fixture.componentInstance.password = 'wrong-password';
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(login).toHaveBeenCalledOnceWith('teknisi@example.test', 'wrong-password');
    rejectLogin(new Error('Email atau kata sandi salah.'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Email atau kata sandi salah.');
    const button = fixture.nativeElement.querySelector('button.btn-primary') as HTMLButtonElement;
    expect(button.disabled).toBeFalse();
    expect(button.textContent?.trim()).toBe('Masuk');
  });
});

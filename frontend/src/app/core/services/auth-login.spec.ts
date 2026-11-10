import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

describe('Login requests', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let router: { events: Subject<unknown>; navigate: jasmine.Spy; url: string; getCurrentNavigation: () => null };
  beforeEach(() => {
    localStorage.removeItem('unzanet_token');
    router = { events: new Subject(), navigate: jasmine.createSpy('navigate').and.resolveTo(true), url: '/login', getCurrentNavigation: () => null };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: Router, useValue: router },
    ] });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => { http.verify(); localStorage.removeItem('unzanet_token'); });

  it('returns a wrong-password error once without sending or invalidating a stale token', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'old-token');
    let message = '';
    void auth.login('teknisi@example.test', 'wrong').catch(error => { message = error.message; });
    const request = http.expectOne(req => req.url.endsWith('/auth/login'));
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ message: 'Email atau kata sandi salah.' }, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    expect(message).toBe('Email atau kata sandi salah.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('unzanet_token')).toBe('old-token');
    expect(auth.user()).toBeNull();
  }));

  it('cancels a stalled request after 15 seconds without automatically retrying', fakeAsync(() => {
    let message = '';
    void auth.login('teknisi@example.test', 'wrong').catch(error => { message = error.message; });
    const request = http.expectOne(req => req.url.endsWith('/auth/login'));
    tick(14999); expect(message).toBe('');
    tick(1); flushMicrotasks();
    expect(message).toContain('Koneksi login terlalu lama');
    expect(request.cancelled).toBeTrue();
    http.expectNone(req => req.url.endsWith('/auth/login'));
  }));

  it('still clears expired tokens on protected API requests', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'expired-token');
    TestBed.inject(ApiService).get('/auth/me').subscribe({ error: () => {} });
    const request = http.expectOne(req => req.url.endsWith('/auth/me'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer expired-token');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    expect(localStorage.getItem('unzanet_token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'session-expired' } });
  }));

  it('does not send a forbidden URL role while restoring a session with /auth/me', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'valid-token');
    router.url = '/dashboard/finance/tagihan';
    void auth.loadUser();
    const request = http.expectOne(req => req.url.endsWith('/auth/me'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer valid-token');
    expect(request.request.headers.has('X-Access-Role')).toBeFalse();
    request.flush({ user: { id: '7', name: 'Sales', role: 'sales', status: 'active' } });
    flushMicrotasks();
    expect(auth.user()?.role).toBe('sales');
    expect(localStorage.getItem('unzanet_token')).toBe('valid-token');
  }));

  for (const role of ['sales', 'finance', 'kolektor', 'teknisi', 'admin'] as const) {
    it(`keeps the ${role} session on 403 and returns to its own dashboard`, fakeAsync(() => {
      localStorage.setItem('unzanet_token', 'valid-token');
      auth.user.set({ id: '7', name: 'User', email: 'user@example.test', role, status: 'active' } as any);
      router.url = '/dashboard/finance/tagihan';
      TestBed.inject(ApiService).get('/users').subscribe({ error: () => {} });
      const request = http.expectOne(req => req.url.endsWith('/users'));
      if (role !== 'finance' && role !== 'admin') expect(request.request.headers.has('X-Access-Role')).toBeFalse();
      request.flush({ message: 'Anda tidak memiliki akses.' }, { status: 403, statusText: 'Forbidden' });
      flushMicrotasks();
      expect(localStorage.getItem('unzanet_token')).toBe('valid-token');
      expect(auth.user()?.role).toBe(role);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
    }));
  }

  it('clears cached user state as well as the token on a genuine 401', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'expired-token');
    auth.user.set({ id: '7', role: 'sales' } as any);
    auth.accessContext.set('sales');
    TestBed.inject(ApiService).get('/dashboard').subscribe({ error: () => {} });
    http.expectOne(req => req.url.endsWith('/dashboard')).flush({}, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    expect(auth.user()).toBeNull();
    expect(auth.accessContext()).toBeNull();
    expect(localStorage.getItem('unzanet_token')).toBeNull();
  }));

  it('does not let an old request remove a newly established session', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'old-token');
    TestBed.inject(ApiService).get('/old-request').subscribe({ error: () => {} });
    const request = http.expectOne(req => req.url.endsWith('/old-request'));
    localStorage.setItem('unzanet_token', 'new-token');
    auth.user.set({ id: '7', role: 'sales' } as any);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    expect(localStorage.getItem('unzanet_token')).toBe('new-token');
    expect(auth.user()?.role).toBe('sales');
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('preserves an explicitly granted additional role in API requests', fakeAsync(() => {
    localStorage.setItem('unzanet_token', 'valid-token');
    auth.user.set({ id: '7', role: 'finance', additionalRoles: ['sales'] } as any);
    router.url = '/dashboard/registrasi-pelanggan';
    TestBed.inject(ApiService).get('/psb').subscribe();
    const request = http.expectOne(req => req.url.endsWith('/psb'));
    expect(request.request.headers.get('X-Access-Role')).toBe('sales');
    request.flush({}); flushMicrotasks();
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('navigates to the primary role dashboard after a successful login', fakeAsync(() => {
    void auth.login('user@example.test', 'correct-password');
    http.expectOne(req => req.url.endsWith('/auth/login')).flush({
      accessToken: 'new-token', user: { id: '7', role: 'sales', status: 'active' },
    });
    flushMicrotasks();
    expect(localStorage.getItem('unzanet_token')).toBe('new-token');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));
});

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { DASHBOARD_URL, roleForUrl, userRoles } from '../access-roles';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  // A bad password is not an expired authenticated session. Do not attach a
  // stale token or redirect the login form when its own request returns 401.
  const isLogin = req.url.split('?')[0].endsWith('/auth/login');
  const isAuthRequest = /\/auth(?:\/|$)/.test(req.url.split('?')[0]);
  const token = isLogin ? null : localStorage.getItem('unzanet_token');
  if (token) {
    const user = auth.user();
    const requestedRole = isAuthRequest ? null : roleForUrl(router.getCurrentNavigation()?.finalUrl?.toString() ?? router.url);
    const accessRole = requestedRole && user && userRoles(user).includes(requestedRole) ? requestedRole : null;
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}`, ...(accessRole ? { 'X-Access-Role': accessRole } : {}) },
    });
  }
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token && localStorage.getItem('unzanet_token') === token) {
        auth.clearSession();
        void router.navigate(['/login'], {
          queryParams: { reason: 'session-expired' },
        });
      }
      if (error.status === 403 && token && localStorage.getItem('unzanet_token') === token && !isAuthRequest) {
        const user = auth.user();
        if (user) {
          auth.accessContext.set(null);
          void router.navigate([DASHBOARD_URL], { replaceUrl: true });
        }
      }
      return throwError(() => error);
    }),
  );
};

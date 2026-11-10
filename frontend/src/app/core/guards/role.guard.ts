import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { firstValueFrom, isObservable } from 'rxjs';
import { DASHBOARD_URL, roleForUrl, userRoles } from '../access-roles';

export function roleGuard(...roles: string[]): CanActivateFn {
  return async (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const result = authGuard(route, state);
    const authenticated = await (isObservable(result) ? firstValueFrom(result) : result);
    if (authenticated !== true) return authenticated;
    const user = auth.user();
    if (!user) return router.createUrlTree(['/login']);
    if (roles.some(role => userRoles(user).includes(role))) {
      auth.accessContext?.set(roleForUrl(state.url ?? ''));
      return true;
    }
    auth.accessContext?.set(null);
    return router.createUrlTree([DASHBOARD_URL]);
  };
}

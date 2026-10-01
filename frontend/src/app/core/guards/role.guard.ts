import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { firstValueFrom, isObservable } from 'rxjs';

export function roleGuard(...roles: string[]): CanActivateFn {
  return async (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const result = authGuard(route, state);
    const authenticated = await (isObservable(result) ? firstValueFrom(result) : result);
    if (authenticated !== true) return authenticated;
    const user = auth.user();
    if (user && roles.includes(user.role)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}

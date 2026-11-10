import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Parent authGuard protects this route. Reset the feature-role context before
// HomeComponent initializes so /dashboard always uses the user's primary role.
export const dashboardGuard: CanActivateFn = () => {
  inject(AuthService).accessContext?.set(null);
  return true;
};

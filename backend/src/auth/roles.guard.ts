import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthRequest } from './jwt-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.user.role !== 'admin') throw new ForbiddenException('Fitur ini hanya untuk admin.');
    return true;
  }
}

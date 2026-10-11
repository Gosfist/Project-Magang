import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRequest } from './jwt-auth.guard.js';
import { ROLES_KEY } from './roles.decorator.js';
import { accessRoles } from './access-roles.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if ((request.user.primaryRole ?? request.user.role) !== 'admin') throw new ForbiddenException('Fitur ini hanya untuk admin.');
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles =
      this.reflector.get<string[]>(ROLES_KEY, context.getHandler()) ??
      this.reflector.get<string[]>(ROLES_KEY, context.getClass());
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const available = accessRoles(request.user);
    if (!roles.some(role => available.includes(role))) {
      throw new ForbiddenException('Anda tidak memiliki akses ke fitur ini.');
    }
    if (request.user.primaryRole !== 'admin' && request.user.accessRole && !roles.includes(request.user.accessRole)) {
      throw new ForbiddenException('Aksi ini tidak tersedia dalam menu role yang sedang dibuka.');
    }
    if (!roles.includes(request.user.role) && !request.user.accessRole) {
      request.user.role = roles.find(role => available.includes(role))!;
    }
    return true;
  }
}

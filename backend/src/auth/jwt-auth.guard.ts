import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { accessRoles } from './access-roles.js';

export type AuthRequest = Request & { user: { id: string; role: string; primaryRole?: string; additionalRoles?: unknown; accessRole?: string } };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Token autentikasi tidak tersedia.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.sub) }, select: { role: true, additionalRoles: true, status: true } });
      if (!user || user.status !== 'active') throw new UnauthorizedException();
      const contextRole = request.headers['x-access-role'];
      if (contextRole !== undefined && (typeof contextRole !== 'string' || !accessRoles(user).includes(contextRole))) {
        throw new UnauthorizedException('Hak akses tidak tersedia.');
      }
      request.user = { id: payload.sub, primaryRole: user.role, additionalRoles: user.additionalRoles,
        role: typeof contextRole === 'string' ? contextRole : user.role,
        accessRole: typeof contextRole === 'string' ? contextRole : undefined };
      return true;
    } catch {
      throw new UnauthorizedException('Token autentikasi tidak valid atau sudah kedaluwarsa.');
    }
  }
}

import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminGuard, RolesGuard } from './roles.guard.js';
import { CreateUserDto } from '../users/users.dto.js';
import { validate } from 'class-validator';

const context = (request: any): any => ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => ({}), getClass: () => ({}) });
describe('additional role authorization', () => {
  it('uses current database rights instead of stale JWT roles, including revocation', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: '7', role: 'admin' }) };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'finance', additionalRoles: ['sales'], status: 'active' }) } };
    const guard = new JwtAuthGuard(jwt as any, prisma as any);
    const request: any = { headers: { authorization: 'Bearer test', 'x-access-role': 'sales' } };
    await guard.canActivate(context(request));
    expect(request.user).toMatchObject({ id: '7', role: 'sales', primaryRole: 'finance' });
    prisma.user.findUnique.mockResolvedValue({ role: 'finance', additionalRoles: [], status: 'active' });
    await expect(guard.canActivate(context(request))).rejects.toThrow();
  });
  it('allows granted roles and administrator access but protects admin management and role context', () => {
    const reflector = { get: () => ['sales'] };
    const guard = new RolesGuard(reflector as Reflector);
    expect(guard.canActivate(context({ user: { id: '7', role: 'sales', primaryRole: 'finance', additionalRoles: ['sales'], accessRole: 'sales' } }))).toBe(true);
    expect(() => guard.canActivate(context({ user: { role: 'finance', additionalRoles: [] } }))).toThrow();
    expect(() => new AdminGuard().canActivate(context({ user: { role: 'sales', primaryRole: 'finance', additionalRoles: ['sales'] } }))).toThrow();
    expect(guard.canActivate(context({ user: { role: 'admin', primaryRole: 'admin' } }))).toBe(true);
    expect(() => guard.canActivate(context({ user: { role: 'finance', primaryRole: 'finance', additionalRoles: ['sales'], accessRole: 'finance' } }))).toThrow();
  });
  it('rejects granting administrator as an additional role', async () => {
    const dto = Object.assign(new CreateUserDto(), { name: 'Finance', email: 'finance@example.com', password: 'abcdef', role: 'finance', status: 'active', additionalRoles: ['admin'] });
    expect((await validate(dto)).some(error => error.property === 'additionalRoles')).toBe(true);
  });
});

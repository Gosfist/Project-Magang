import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('Authentication is distinct from role authorization', () => {
  function setup(role = 'sales', additionalRoles: string[] = []) {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: '7', role }) };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ role, additionalRoles, status: 'active' }) } };
    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
    return { jwt, prisma, request, context, guard: new JwtAuthGuard(jwt as any, prisma as any) };
  }
  it.each(['admin', 'finance', 'kolektor', 'teknisi'])('returns 403, not a logout-triggering 401, for ungranted %s context', async role => {
    const { request, guard, context } = setup();
    request.headers['x-access-role'] = role;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request.user).toBeUndefined();
  });
  it('accepts the primary role and explicitly granted additional roles', async () => {
    const { request, guard, context } = setup('sales', ['kolektor']);
    request.headers['x-access-role'] = 'kolektor';
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: '7', role: 'kolektor', primaryRole: 'sales' });
  });
  it('still returns 401 for expired tokens and inactive users', async () => {
    const { jwt, prisma, guard, context } = setup();
    jwt.verifyAsync.mockRejectedValueOnce(new Error('expired'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValue({ role: 'sales', additionalRoles: [], status: 'inactive' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('does not disguise a database outage as an expired token', async () => {
    const { prisma, guard, context } = setup();
    const databaseError = new Error('database unavailable');
    prisma.user.findUnique.mockRejectedValue(databaseError);
    await expect(guard.canActivate(context)).rejects.toBe(databaseError);
  });
});

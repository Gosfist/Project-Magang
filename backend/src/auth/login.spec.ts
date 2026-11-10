import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service.js';

describe('Login authentication and query scope', () => {
  let password: string;
  beforeAll(async () => { password = await hash('fixture-password', 4); });
  function setup(user: object | null) {
    const findUnique = vi.fn().mockResolvedValue(user);
    const signAsync = vi.fn().mockResolvedValue('fixture-token');
    return { findUnique, signAsync, service: new AuthService({ user: { findUnique } } as any, { signAsync } as any) };
  }
  it('rejects a missing user with one unique lookup and no token', async () => {
    const { service, findUnique, signAsync } = setup(null);
    await expect(service.login({ email: 'missing@example.test', password: 'wrong' })).rejects.toThrow('Email atau kata sandi salah.');
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'missing@example.test' } });
    expect(signAsync).not.toHaveBeenCalled();
  });
  it('rejects an incorrect password without further database queries or signing', async () => {
    const { service, findUnique, signAsync } = setup({ id: 1n, password, status: 'active' });
    await expect(service.login({ email: 'user@example.test', password: 'wrong' })).rejects.toThrow('Email atau kata sandi salah.');
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(signAsync).not.toHaveBeenCalled();
  });
  it('does not issue a token for an inactive account', async () => {
    const { service, signAsync } = setup({ id: 1n, password, status: 'inactive' });
    await expect(service.login({ email: 'user@example.test', password: 'fixture-password' })).rejects.toThrow('Akun Anda tidak aktif.');
    expect(signAsync).not.toHaveBeenCalled();
  });
  it('returns a safe user and signed token with a single indexed lookup', async () => {
    const { service, findUnique, signAsync } = setup({ id: 1n, email: 'user@example.test', password, status: 'active', role: 'teknisi', additionalRoles: ['sales'] });
    const result = await service.login({ email: 'user@example.test', password: 'fixture-password' });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(signAsync).toHaveBeenCalledExactlyOnceWith({ sub: '1', role: 'teknisi' });
    expect(result.user).not.toHaveProperty('password');
    expect(result.user.additionalRoles).toEqual(['sales']);
    expect(result.accessToken).toBe('fixture-token');
  });
});

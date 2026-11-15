import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service.js';
it('preserves employee payroll history when an account with related records is deleted', async () => {
  const db = { user: { findUnique: vi.fn().mockResolvedValue({id:7n}), delete: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('FK', {code:'P2003',clientVersion:'6.12.0'})) } };
  await expect(new UsersService(db as any).remove('7','1')).rejects.toThrow('Nonaktifkan akun');
  expect(db.user.delete).toHaveBeenCalledWith({where:{id:7n}});
});

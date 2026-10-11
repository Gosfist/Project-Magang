import { describe, expect, it, vi } from 'vitest';
import { DataPelangganService } from './data-pelanggan.service.js';
describe('PPPoE credentials detail', () => {
  it('decrypts only the selected account credential', async () => {
    const prisma = { pppoeAccount: { findUnique: vi.fn().mockResolvedValue({ username: 'test-user', password: 'encrypted-value' }) } };
    const secrets = { decrypt: vi.fn().mockReturnValue('test-password') };
    const service = new DataPelangganService(prisma as any, {} as any, secrets as any, {} as any);
    expect(await service.credentials('1')).toEqual({ username: 'test-user', password: 'test-password' });
    expect(prisma.pppoeAccount.findUnique).toHaveBeenCalledWith({ where: { id: 1n } });
    expect(secrets.decrypt).toHaveBeenCalledWith('encrypted-value');
  });
  it('rejects missing accounts', async () => {
    const prisma = { pppoeAccount: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new DataPelangganService(prisma as any, {} as any, {} as any, {} as any);
    await expect(service.credentials('1')).rejects.toThrow('Akun PPPoE tidak ditemukan');
  });
});

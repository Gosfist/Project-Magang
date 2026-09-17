import { PppoeService } from './pppoe.service.js';
import { RadiusService } from './radius.service.js';

describe('Customer session filters', () => {
  it('filters all matching sessions before pagination and excludes unknown sessions from offline', async () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: BigInt(i + 1), customerNumber: BigInt(i + 1), username: `user${i}`, isActive: true,
      expiresAt: null, paymentPromises: [], discount: 0n, package: { isActive: true, price: 0n, costPrice: 0n } }));
    const findMany = vi.fn().mockResolvedValue(items);
    const prisma = { pppoeAccount: { findMany, count: vi.fn().mockResolvedValue(9) }, $transaction: (ops: any[]) => Promise.all(ops) };
    const network = { accountPresence: vi.fn(async () => ({ states: new Map(items.map((item, i) => [item.username, i === 0 ? null : i === 1 ? true : false])), warnings: [] })) };
    const service = new PppoeService(prisma as any, {} as any, {} as any, network as any);
    const result = await service.accounts('', 2, '', 'offline');
    expect(result.meta.total).toBe(7);
    expect(result.data.map(item => item.username)).toEqual(['user7', 'user8']);
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(findMany.mock.calls[0][0]).toMatchObject({ omit: { password: true } });
  });
  it('rejects unexpected filters instead of silently ignoring them', async () => {
    const service = new PppoeService({} as any, {} as any, {} as any, {} as any);
    await expect(service.accounts('', 1, 'bogus')).rejects.toThrow('Filter status');
  });
});

describe('Promise RADIUS expiration', () => {
  it('uses an absolute Unix expiration for WIB deadline while preserving single session policy', async () => {
    const tx = { radcheck: { deleteMany: vi.fn(), createMany: vi.fn() }, radreply: { deleteMany: vi.fn(), createMany: vi.fn() },
      paymentPromise: { findFirst: vi.fn().mockResolvedValue({ deadline: new Date('2026-09-18T17:00:00Z') }) } };
    const service = new RadiusService({ decrypt: () => 'private' } as any);
    await service.sync(tx as any, { id: 1n, username: 'suro', password: 'encrypted', isActive: true, expiresAt: new Date('2026-09-01'), package: { isActive: true, uploadMbps: 5, downloadMbps: 10 } } as any);
    expect(tx.radcheck.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      { username: 'suro', attribute: 'Expiration', op: ':=', value: String(Date.parse('2026-09-18T17:00:00Z') / 1000) },
      { username: 'suro', attribute: 'Simultaneous-Use', op: ':=', value: '1' },
    ]) });
  });
});

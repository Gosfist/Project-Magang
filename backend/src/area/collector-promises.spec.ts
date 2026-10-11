import { describe, it, expect, vi } from 'vitest';
import { AreaService } from './area.service.js';
describe('collector promise list', () => {
  it('scopes both list and total to the assigned collector areas while paginating search results', async () => {
    const prisma = { paymentPromise: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(12) },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)) };
    const service = new AreaService(prisma as any);
    const result = await service.collectorPromises('7', 'Andi', 2);
    const where = { account: { area: { collectors: { some: { userId: 7n } } },
      OR: [{ customerName: { contains: 'Andi' } }, { phone: { contains: 'Andi' } }, { username: { contains: 'Andi' } }] } };
    expect(prisma.paymentPromise.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10, orderBy: { id: 'desc' } }));
    expect(prisma.paymentPromise.count).toHaveBeenCalledWith({ where });
    expect(result).toMatchObject({ data: [], meta: { total: 12, currentPage: 2 } });
  });
});

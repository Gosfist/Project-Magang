import { describe, it, expect, vi } from 'vitest';
import { AreaService } from './area.service.js';

describe('collector account assignments', () => {
  it.each(['admin', 'teknisi', 'kolektor'])('returns no customers for unassigned %s', async primaryRole => {
    const prisma = { areaCollector: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = new AreaService(prisma as any);
    const result = await service.getCollectorCustomers('', 'ALL', { id: '7', role: 'kolektor', primaryRole });
    expect(prisma.areaCollector.findMany).toHaveBeenCalledWith({ where: { userId: 7n }, select: { areaId: true } });
    expect(result.summary.totalCustomers).toBe(0);
    expect(result.customers).toEqual([]);
  });

  it('limits administrator collector mode to its assigned areas', async () => {
    const prisma = { areaCollector: { findMany: vi.fn().mockResolvedValue([{ areaId: 2n }]) } };
    const service = new AreaService(prisma as any);
    const getArea = vi.spyOn(service, 'getAreaCustomers').mockResolvedValue({ customers: [], summary: { totalCustomers: 0, unpaidCustomers: 0, paidCustomers: 0, totalUnpaidAmount: 0 } } as any);
    const user = { id: '7', role: 'kolektor', primaryRole: 'admin' };
    await service.getCollectorCustomers('', 'ALL', user);
    expect(getArea).toHaveBeenCalledExactlyOnceWith('2', '', 'ALL', user);
  });
});

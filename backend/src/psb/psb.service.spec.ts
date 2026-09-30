import { describe, expect, it, vi } from 'vitest';
import { PsbService } from './psb.service.js';

describe('PSB fee paid to technician', () => {
  function setup(fee = 150000) {
    const order = { id: 1n, status: 'ACTIVATED', pppoeAccountId: 2n, customerNumber: 1n,
      customerName: 'Andi', phone: '08123456789', package: { name: '5 Mb', price: 110000n } };
    const prisma = {
      psbOrder: { findUnique: vi.fn().mockResolvedValue(order), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      invoice: { create: vi.fn() },
    };
    const settings = { psb: vi.fn().mockResolvedValue({ installationFee: fee }),
      billing: vi.fn().mockResolvedValue({ billingStartDay: 5, billingEndDay: 10 }) };
    const wa = { notifyPsbCompleted: vi.fn().mockResolvedValue(true) };
    const service = new PsbService(prisma as any, {} as any, {} as any, settings as any, wa as any);
    return { service, prisma, wa };
  }
  it.each([0, 150000])('records Rp%s as received without invoicing the collector', async fee => {
    const { service, prisma, wa } = setup(fee);
    expect(await service.completionSummary('1')).toEqual({ installationFee: fee });
    await service.complete('1', '7', { installationFeePaid: fee });
    expect(prisma.psbOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1n, status: 'ACTIVATED' },
      data: { status: 'COMPLETED', completedByUserId: 7n, completedAt: expect.any(Date), installationFeePaid: BigInt(fee) },
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(wa.notifyPsbCompleted).toHaveBeenCalledTimes(1);
  });
  it('requires confirmation of the current fee', async () => {
    const { service, prisma, wa } = setup();
    await expect(service.complete('1', '7', { installationFeePaid: 100000 })).rejects.toThrow('Biaya PSB berubah');
    expect(prisma.psbOrder.updateMany).not.toHaveBeenCalled();
    expect(wa.notifyPsbCompleted).not.toHaveBeenCalled();
  });
  it('does not notify twice when another request completed the order', async () => {
    const { service, prisma, wa } = setup();
    prisma.psbOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.complete('1', '7', { installationFeePaid: 150000 })).rejects.toThrow('sudah diselesaikan');
    expect(wa.notifyPsbCompleted).not.toHaveBeenCalled();
  });
});

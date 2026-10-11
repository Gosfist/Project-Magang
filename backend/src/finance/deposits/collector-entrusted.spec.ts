import { describe, expect, it, vi } from 'vitest';
import { FinanceDepositsService } from './finance-deposits.service.js';
import { FinanceDepositsController } from './finance-deposits.controller.js';
import { FinanceInvoicesService } from '../invoices/finance-invoices.service.js';

const foreignAreaAccount = { is: { area: { is: { collectors: { none: { userId: 7n } } } } } };

describe('collector entrusted payments from other areas', () => {
  it('scopes rows and pagination count to deposits received by this collector outside their assigned areas', async () => {
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    await new FinanceDepositsService(prisma as any, {} as any).list('ACCEPTED', '7', '', '', 'Paijo', 2, 15, true);
    const query = prisma.collectorDeposit.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ collectorUserId: 7n, account: foreignAreaAccount, status: 'ACCEPTED', OR: expect.any(Array) });
    expect(query.skip).toBe(15);
    expect(prisma.collectorDeposit.count).toHaveBeenCalledWith({ where: query.where });
  });

  it('does not hide own-area payments from Finance', async () => {
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    await new FinanceDepositsService(prisma as any, {} as any).list('', '7');
    expect(prisma.collectorDeposit.findMany.mock.calls[0][0].where).toEqual({ collectorUserId: 7n });
  });

  it('cannot bypass collector scope by supplying a different collector ID', async () => {
    const service = { list: vi.fn() };
    new FinanceDepositsController(service as any).list({ user: { role: 'kolektor', id: '7' } } as any, '', '99', '', '', '', 1);
    expect(service.list).toHaveBeenCalledWith('', '7', '', '', '', 1, 15, true);
  });

  it('only offers invoices from other assigned areas when recording a new Titipan', async () => {
    const prisma = { invoice: { findMany: vi.fn().mockResolvedValue([]) }, pppoeAccount: { findFirst: vi.fn().mockResolvedValue(null) } };
    await new FinanceInvoicesService(prisma as any).unpaidInvoices('000002', '7');
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({
      account: foreignAreaAccount, status: { in: ['PENDING', 'OVERDUE'] }, AND: [{ account: { customerNumber: 2n } }],
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { customerSearch } from './customer-search.js';
import { PsbService } from '../psb/psb.service.js';
import { FinanceDepositsService } from '../finance/deposits/finance-deposits.service.js';
import { FinanceInvoicesService } from '../finance/invoices/finance-invoices.service.js';

describe('customer number and name searches', () => {
  it('trims names, accepts padded numbers and avoids overflowing database bigint', () => {
    expect(customerSearch(' Andi ')).toEqual({ OR: [{ customerName: { contains: 'Andi' } }] });
    expect(customerSearch(' 000042 ')).toMatchObject({ OR: expect.arrayContaining([{ customerNumber: 42n }]) });
    expect(customerSearch('9'.repeat(100)).OR).toHaveLength(1);
    expect(customerSearch('  ')).toEqual({});
  });

  it.each(['Andi', '000042'])('preserves technician ownership and uses the same count for %s', async query => {
    const prisma = { psbOrder: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests) };
    const network = { accountPresence: vi.fn().mockResolvedValue({ states: new Map(), warnings: [] }) };
    await new PsbService(prisma as any, {} as any, {} as any, {} as any, {} as any, network as any)
      .list({ id: '7', role: 'teknisi' }, query, 'PROCESS');
    const where = prisma.psbOrder.findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ status: 'ACTIVATED', activatedByUserId: 7n });
    expect(where.AND).toEqual([customerSearch(query)]);
    expect(prisma.psbOrder.count).toHaveBeenCalledWith({ where });
  });

  it('finds names in live accounts and archived deposits while keeping collector scope', async () => {
    const prisma = { collectorDeposit: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests) };
    const service = new FinanceDepositsService(prisma as any, {} as any);
    await service.list('', '7', '', '', ' Andi ', 1, 15, true);
    const where = prisma.collectorDeposit.count.mock.calls[0][0].where;
    expect(where.collectorUserId).toBe(7n);
    expect(where.account.is.area.is.collectors.none.userId).toBe(7n);
    expect(where.AND[0].OR).toEqual([{ account: customerSearch('Andi') }]);
    await service.list('', '', '', '', 'Andi');
    expect(prisma.collectorDeposit.count.mock.calls[1][0].where.AND[0].OR)
      .toContainEqual({ customerSnapshot: { path: '$.customerName', string_contains: 'Andi' } });
  });

  it('allows name searches for unpaid invoices while retaining foreign-area scope', async () => {
    const prisma = { invoice: { findMany: vi.fn().mockResolvedValue([]) }, pppoeAccount: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new FinanceInvoicesService(prisma as any);
    await service.unpaidInvoices(' Andi ', '7');
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.account.is.area.is.collectors.none.userId).toBe(7n);
    expect(where.AND).toEqual([{ account: customerSearch('Andi') }]);
    expect(where.deposits.none.status.in).toEqual(['PENDING', 'ACCEPTED']);
    expect(await service.unpaidInvoices(' ')).toEqual({ data: [] });
    expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
  });
});

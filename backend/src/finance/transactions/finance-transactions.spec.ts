import { describe, expect, it, vi } from 'vitest';
import { FinanceTransactionsService } from './finance-transactions.service.js';

describe('transaction invoice search', () => {
  it('filters count and pagination by referenced invoice and returns its number', async () => {
    const invoiceNumber = 'INV/202611/0000001';
    const prisma = {
      collectorDeposit: { findMany: vi.fn()
        .mockResolvedValueOnce([{ id: 7n }])
        .mockResolvedValueOnce([{ id: 7n, invoice: { invoiceNumber } }]) },
      financeTransaction: {
        findMany: vi.fn().mockResolvedValue([{ id: 10n, amount: 110000n, referenceType: 'DEPOSIT', referenceId: 7n }]),
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    const result = await new FinanceTransactionsService(prisma as any).list(' 0000001 ', 'INCOME', '', '', '', 2, 10);
    expect(prisma.collectorDeposit.findMany).toHaveBeenNthCalledWith(1, {
      where: { invoice: { invoiceNumber: { contains: '0000001' } } }, select: { id: true },
    });
    const where = { referenceType: 'DEPOSIT', referenceId: { in: [7n] }, type: 'INCOME' };
    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10 }));
    expect(prisma.financeTransaction.count).toHaveBeenCalledWith({ where });
    expect(result.data[0].invoiceNumber).toBe(invoiceNumber);
  });

  it('does not invent an invoice number for manual or missing references', async () => {
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([]) },
      financeTransaction: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1n, amount: 10n, referenceType: null, referenceId: null },
          { id: 2n, amount: 20n, referenceType: 'DEPOSIT', referenceId: 99n },
        ]), count: vi.fn().mockResolvedValue(2),
      },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    const result = await new FinanceTransactionsService(prisma as any).list();
    expect(result.data.map((row) => row.invoiceNumber)).toEqual([null, null]);
  });
});

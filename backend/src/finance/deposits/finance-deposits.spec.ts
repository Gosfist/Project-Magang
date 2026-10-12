import { describe, expect, it, vi } from 'vitest';
import { FinanceDepositsService } from './finance-deposits.service.js';

describe('payments for deleted customers', () => {
  it('searches padded customer numbers and snapshots without removing collector/area restrictions', async () => {
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    await new FinanceDepositsService(prisma as any, {} as any).list('', '5', '', '', '000042', 1, 15, true);
    const where = prisma.collectorDeposit.count.mock.calls[0][0].where;
    expect(where.collectorUserId).toBe(5n);
    expect(where.account.is.area.is.collectors.none.userId).toBe(5n);
    expect(where.AND[0]).toEqual({ OR: [{ account: { OR: [{ customerName: { contains: '000042' } }, { customerNumber: 42n }] } }] });
    await new FinanceDepositsService(prisma as any, {} as any).list('', '', '', '', '000042');
    const archiveWhere = prisma.collectorDeposit.count.mock.calls[1][0].where;
    expect(archiveWhere.AND[0].OR).toContainEqual({ customerSnapshot: { path: '$.customerNumber', equals: '42' } });
  });
  it('retains customer identity in deposit lists', async () => {
    const snapshot = { customerName: 'Andi', customerNumber: '42', username: 'andi', deleted: true };
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([{ amount: 110000n, account: null, customerSnapshot: snapshot, invoice: null }]), count: vi.fn().mockResolvedValue(1) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    const result = await new FinanceDepositsService(prisma as any, {} as any).list();
    expect(result.data[0].account).toEqual(snapshot);
  });
  it('can accept a pending deposit without restoring or notifying a deleted customer', async () => {
    const deposit = { id: 8n, invoiceId: 10n, pppoeAccountId: null, amount: 110000n, status: 'PENDING',
      account: null, customerSnapshot: { customerName: 'Andi' }, collector: { name: 'Kolektor' } };
    const tx = { collectorDeposit: { update: vi.fn() }, invoice: { update: vi.fn() }, financeTransaction: { create: vi.fn() } };
    const prisma = { collectorDeposit: { findUnique: vi.fn().mockResolvedValue(deposit) },
      pppoeAccount: { findUnique: vi.fn() }, $transaction: (action: (client: typeof tx) => Promise<void>) => action(tx) };
    const wa = { notifyDepositAccepted: vi.fn() };
    await new FinanceDepositsService(prisma as any, {} as any, wa as any).accept('8', '1');
    expect(tx.invoice.update).toHaveBeenCalled();
    expect(tx.financeTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ description: 'Setoran dari kolektor Kolektor untuk pelanggan Andi' }) });
    expect(prisma.pppoeAccount.findUnique).not.toHaveBeenCalled();
    expect(wa.notifyDepositAccepted).not.toHaveBeenCalled();
  });
});

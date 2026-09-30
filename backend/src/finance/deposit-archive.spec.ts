import { describe, expect, it, vi } from 'vitest';
import { DepositService } from './deposit.service.js';

describe('payments for deleted customers', () => {
  it('retains customer identity in deposit lists', async () => {
    const snapshot = { customerName: 'Andi', customerNumber: '42', username: 'andi', deleted: true };
    const prisma = {
      collectorDeposit: { findMany: vi.fn().mockResolvedValue([{ amount: 110000n, account: null, customerSnapshot: snapshot, invoice: null }]), count: vi.fn().mockResolvedValue(1) },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    };
    const result = await new DepositService(prisma as any).list();
    expect(result.data[0].account).toEqual(snapshot);
  });
  it('can accept a pending deposit without restoring or notifying a deleted customer', async () => {
    const deposit = { id: 8n, invoiceId: 10n, pppoeAccountId: null, amount: 110000n, status: 'PENDING',
      account: null, customerSnapshot: { customerName: 'Andi' }, collector: { name: 'Kolektor' } };
    const tx = { collectorDeposit: { update: vi.fn() }, invoice: { update: vi.fn() }, financeTransaction: { create: vi.fn() } };
    const prisma = { collectorDeposit: { findUnique: vi.fn().mockResolvedValue(deposit) },
      pppoeAccount: { findUnique: vi.fn() }, $transaction: (action: (client: typeof tx) => Promise<void>) => action(tx) };
    const wa = { notifyDepositAccepted: vi.fn() };
    await new DepositService(prisma as any, wa as any).accept('8', '1');
    expect(tx.invoice.update).toHaveBeenCalled();
    expect(tx.financeTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ description: 'Setoran dari kolektor Kolektor untuk pelanggan Andi' }) });
    expect(prisma.pppoeAccount.findUnique).not.toHaveBeenCalled();
    expect(wa.notifyDepositAccepted).not.toHaveBeenCalled();
  });
});

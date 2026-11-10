import { describe, expect, it, vi } from 'vitest';
import { FinanceDepositsService } from './finance-deposits.service.js';

describe('Deposit status race protection', () => {
  it('does not create two income records when two requests read the same pending deposit', async () => {
    let status = 'PENDING';
    let paid = false;
    let tail = Promise.resolve();
    const deposit = { id: 1n, invoiceId: 10n, pppoeAccountId: null, amount: 100000n, status: 'PENDING', account: null, collector: { name: 'Kolektor' } };
    const tx = {
      collectorDeposit: {
        update: vi.fn(async ({ data }) => { status = data.status; }),
        updateMany: vi.fn(async ({ where, data }) => { if (status !== where.status) return { count: 0 }; status = data.status; return { count: 1 }; }),
      },
      invoice: {
        update: vi.fn(async () => { paid = true; }),
        updateMany: vi.fn(async () => { if (paid) return { count: 0 }; paid = true; return { count: 1 }; }),
      },
      financeTransaction: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { collectorDeposit: { findUnique: vi.fn(async () => ({ ...deposit })) },
      $transaction: (fn: any) => { const run = tail.then(() => fn(tx)); tail = run.catch(() => undefined); return run; } };
    const service = new FinanceDepositsService(prisma as any, {} as any);
    const results = await Promise.allSettled([service.accept('1', '3'), service.accept('1', '4')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(tx.financeTransaction.create).toHaveBeenCalledTimes(1);
  });
  it('cannot reject a deposit already accepted after the initial status read', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn();
    const service = new FinanceDepositsService({ collectorDeposit: { findUnique: async () => ({ id: 1n, status: 'PENDING' }), updateMany, update } } as any, {} as any);
    await expect(service.reject('1', { reason: 'Uji' })).rejects.toThrow(/berubah|pending/);
    expect(update).not.toHaveBeenCalled();
  });
  it('cannot cancel an acceptance whose status changed after it was read', async () => {
    const tx = { collectorDeposit: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, financeTransaction: { deleteMany: vi.fn() } };
    const service = new FinanceDepositsService({ collectorDeposit: { findUnique: async () => ({ id: 1n, status: 'ACCEPTED' }) }, $transaction: (fn: any) => fn(tx) } as any, {} as any);
    await expect(service.cancelAccept('1')).rejects.toThrow('berubah');
    expect(tx.financeTransaction.deleteMany).not.toHaveBeenCalled();
  });
  it('serializes new collections for the same invoice before checking for duplicates', async () => {
    const rows: any[] = [];
    let tail = Promise.resolve();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      pppoeAccount: { findUnique: vi.fn().mockResolvedValue({ id: 2n, phone: null }) },
      invoice: { findFirst: vi.fn().mockResolvedValue({ id: 10n, amount: 100000n, status: 'PENDING' }) },
      collectorDeposit: { findFirst: vi.fn(async () => rows[0] ?? null), create: vi.fn(async ({ data }) => { const row = { id: 1n, ...data }; rows.push(row); return row; }) },
    };
    const service = new FinanceDepositsService({ ...tx, user: { findUnique: vi.fn().mockResolvedValue({ name: 'Kolektor' }) },
      $transaction: (fn: any) => { const run = tail.then(() => fn(tx)); tail = run.catch(() => undefined); return run; } } as any, {} as any);
    const dto = { pppoeAccountId: '2', invoiceId: '10', depositDate: '2026-11-11' };
    const results = await Promise.allSettled([service.create(dto, '3'), service.create(dto, '4')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(tx.collectorDeposit.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

});

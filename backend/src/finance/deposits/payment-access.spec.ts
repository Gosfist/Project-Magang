import { describe, expect, it, vi } from 'vitest';
import { FinanceDepositsService } from './finance-deposits.service.js';
import { RadiusService } from '../../pppoe/shared/radius.service.js';

function setup(promiseStatus = 'EXPIRED', isActive = false) {
  const state = {
    depositStatus: 'PENDING', invoiceStatus: 'PENDING',
    promise: { status: promiseStatus, disconnectPending: true, deadline: new Date('2026-01-01') },
    account: { id: 2n, username: '000002', password: 'encrypted', isActive, expiresAt: null as Date | null,
      package: { isActive: true, validityDays: 30, uploadMbps: 5, downloadMbps: 5, ipPool: { name: 'customers' } } },
    checks: [] as any[], replies: [] as any[], transactions: 0,
  };
  const tx = {
    collectorDeposit: { update: vi.fn(async ({ data }) => { state.depositStatus = data.status; }) },
    invoice: { update: vi.fn(async ({ data }) => { state.invoiceStatus = data.status; }),
      count: vi.fn(async () => state.invoiceStatus === 'PAID' ? 0 : 1) },
    financeTransaction: { create: vi.fn(async () => { state.transactions++; }) },
    pppoeAccount: { findUnique: vi.fn(async () => state.account),
      update: vi.fn(async ({ data }) => Object.assign(state.account, data)) },
    paymentPromise: {
      updateMany: vi.fn(async ({ where, data }) => { if (where.status.in.includes(state.promise.status)) Object.assign(state.promise, data); }),
      findFirst: vi.fn(async () => state.promise.status === 'ACTIVE' ? state.promise : null),
    },
    radcheck: { deleteMany: vi.fn(async () => { state.checks = []; }), createMany: vi.fn(async ({ data }) => { state.checks = data; }) },
    radreply: { deleteMany: vi.fn(async () => { state.replies = []; }), createMany: vi.fn(async ({ data }) => { state.replies = data; }) },
  };
  const prisma = {
    collectorDeposit: { findUnique: vi.fn(async () => ({ id: 1n, invoiceId: 10n, pppoeAccountId: 2n,
      status: state.depositStatus, amount: 110000n, collector: { name: 'Kolektor' }, account: { customerName: 'Paijo' } })) },
    pppoeAccount: { findUnique: vi.fn(async () => ({ customerName: 'Paijo', customerNumber: '000002', phone: 'test' })) },
    invoice: { findUnique: vi.fn(async () => ({ dueDate: new Date('2026-01-10') })) },
    $transaction: vi.fn(async (action) => {
      const before = structuredClone(state);
      try { return await action(tx); }
      catch (error) { Object.assign(state, before); throw error; }
    }),
  };
  const wa = { notifyDepositAccepted: vi.fn(async () => {}) };
  const radius = new RadiusService({ decrypt: () => 'test-password' } as any);
  const service = new FinanceDepositsService(prisma as any, radius, wa as any);
  return { state, tx, prisma, wa, service };
}

describe('Finance ACC restores RADIUS access', () => {
  it.each(['ACTIVE', 'EXPIRED', 'CANCELLED'])('restores credentials after a %s promise', async (status) => {
    const { state, service } = setup(status);
    await service.accept('1', '3');
    expect(state.depositStatus).toBe('ACCEPTED');
    expect(state.invoiceStatus).toBe('PAID');
    expect(state.account.isActive).toBe(true);
    expect(state.checks).toContainEqual(expect.objectContaining({ attribute: 'Cleartext-Password', value: 'test-password' }));
    expect(state.checks.some(row => row.attribute === 'Expiration')).toBe(false);
    expect(state.replies).toContainEqual(expect.objectContaining({ attribute: 'Framed-Pool', value: 'customers' }));
    if (status !== 'CANCELLED') expect(state.promise).toMatchObject({ status: 'FULFILLED', disconnectPending: false });
  });

  it('rebuilds missing RADIUS credentials even when the account already says active', async () => {
    const { state, service } = setup('CANCELLED', true);
    await service.accept('1', '3');
    expect(state.checks.length).toBeGreaterThan(0);
  });

  it('renews an expired account so restored credentials do not immediately reject login', async () => {
    const { state, service } = setup();
    state.account.expiresAt = new Date(Date.now() - 5 * 86400000);
    await service.accept('1', '3');
    expect(state.account.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(state.checks).toContainEqual(expect.objectContaining({ attribute: 'Expiration' }));
  });

  it('keeps isolation when another invoice is still unpaid', async () => {
    const { state, tx, service } = setup();
    tx.invoice.count.mockResolvedValue(1);
    await service.accept('1', '3');
    expect(state.account.isActive).toBe(false);
    expect(tx.radcheck.createMany).not.toHaveBeenCalled();
  });

  it('rolls back ACC and payment and sends no success notice if RADIUS cannot be restored', async () => {
    const { state, tx, wa, service } = setup();
    tx.radcheck.createMany.mockRejectedValue(new Error('RADIUS unavailable'));
    await expect(service.accept('1', '3')).rejects.toThrow('RADIUS unavailable');
    expect(state).toMatchObject({ depositStatus: 'PENDING', invoiceStatus: 'PENDING', transactions: 0, account: { isActive: false } });
    expect(wa.notifyDepositAccepted).not.toHaveBeenCalled();
  });
});

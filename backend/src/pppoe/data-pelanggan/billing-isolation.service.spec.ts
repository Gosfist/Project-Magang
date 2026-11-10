import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingIsolationService } from './billing-isolation.service.js';

describe('postpaid scheduler activation grace period', () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    ['2026-09-30T17:00:00Z', 110000n, 'MONTHLY'],
    ['2026-10-01T17:00:00Z', 106452n, 'PRORATE'],
  ])('invoices activation %s only in November, then full price in December', async (createdAt, amount, invoiceType) => {
    const account = { id: 1n, customerNumber: 1n, createdAt: new Date(createdAt),
      package: { price: 110000n }, discount: 0n, invoices: [] };
    const create = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([account]);
    const service = new BillingIsolationService({ pppoeAccount: { findMany }, invoice: { create, findMany: vi.fn().mockResolvedValue([]) } } as any,
      { billing: async () => ({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0 }) } as any,
      {} as any, {} as any, {} as any);
    await service.tick(new Date('2026-10-06T03:00:00Z'), 1n);
    expect(findMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date('2026-09-30T17:00:00Z'));
    expect(create).not.toHaveBeenCalled();
    await service.tick(new Date('2026-11-04T03:00:00Z'), 1n);
    expect(create).not.toHaveBeenCalled();
    await service.tick(new Date('2026-11-06T03:00:00Z'), 1n);
    expect(create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ amount, invoiceType, dueDate: new Date('2026-11-10T00:00:00Z') }) });
    account.invoices = [{ id: 5n }] as never;
    await service.tick(new Date('2026-11-06T03:00:00Z'), 1n);
    expect(create).toHaveBeenCalledTimes(1);
    account.invoices = [];
    await service.tick(new Date('2026-12-06T03:00:00Z'), 1n);
    expect(create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ amount: 110000n, invoiceType: 'MONTHLY', dueDate: new Date('2026-12-10T00:00:00Z') }) });
  });
  it('excludes September activations from September billing and isolation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T03:00:00Z'));
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new BillingIsolationService({ pppoeAccount: { findMany }, invoice: { findMany: vi.fn().mockResolvedValue([]) } } as any,
      { billing: async () => ({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0 }) } as any,
      {} as any, {} as any, {} as any);
    await service.tick();
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [query] of findMany.mock.calls) {
      expect(query.where.createdAt.lt).toEqual(new Date('2026-08-31T17:00:00Z'));
    }
  });
  it('keeps the existing prorate bill on October 5 and does not isolate on October 10', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T03:00:00Z'));
    const create = vi.fn();
    const findMany = vi.fn().mockResolvedValue([{ invoices: [{ id: 1n }] }]);
    const service = new BillingIsolationService({ pppoeAccount: { findMany }, invoice: { create, findMany: vi.fn().mockResolvedValue([]) } } as any,
      { billing: async () => ({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0 }) } as any,
      {} as any, {} as any, {} as any);
    await service.tick();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
  it('generates invoices beyond the first 500 eligible customers', async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) => ({ id: BigInt(i + 1), customerNumber: BigInt(i + 1), createdAt: new Date('2026-09-01T00:00:00Z'), package: { price: 100000n }, discount: 0n, invoices: [] }));
    const last = { ...firstPage[0], id: 501n, customerNumber: 501n };
    const findMany = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce([last]);
    const create = vi.fn().mockResolvedValue({});
    const service = new BillingIsolationService({ pppoeAccount: { findMany }, invoice: { create, findMany: vi.fn().mockResolvedValue([]) } } as any,
      { billing: async () => ({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0 }) } as any, {} as any, {} as any, {} as any);
    await service.tick(new Date('2026-11-06T03:00:00Z'));
    expect(create).toHaveBeenCalledTimes(501);
    expect(findMany.mock.calls[1][0].where.id).toEqual({ gt: 500n });
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
  });

  it.each([0, 1])('rechecks isolation eligibility atomically before disconnecting (eligible=%s)', async (count) => {
    const account = { id: 1n, username: '000001', routerNasId: 1, customerName: 'Test', customerNumber: 1n,
      package: { name: '20 Mb' }, invoices: [{ id: 2n, amount: 100000n, dueDate: new Date('2026-11-10T00:00:00Z') }] };
    const tx = { pppoeAccount: { updateMany: vi.fn().mockResolvedValue({ count }), update: vi.fn().mockResolvedValue(account), findUniqueOrThrow: vi.fn().mockResolvedValue(account) },
      paymentPromise: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    const radius = { sync: vi.fn() };
    const network = { disconnect: vi.fn().mockResolvedValue({ warnings: [] }) };
    const wa = { notifyIsolation: vi.fn() };
    const prisma = { pppoeAccount: { findMany: vi.fn().mockResolvedValue([account]) }, $transaction: vi.fn(async (work: any) => work(tx)) };
    const service = new BillingIsolationService(prisma as any, {} as any, radius as any, network as any, wa as any);
    await (service as any).isolateOverdue({ billingEndDay: 10, billingTimezone: 'WIB' }, new Date('2026-11-10T00:00:00Z'), new Date('2026-11-11T00:00:00Z'));
    expect(network.disconnect).toHaveBeenCalledTimes(count);
    expect(radius.sync).toHaveBeenCalledTimes(count);
    expect(wa.notifyIsolation).toHaveBeenCalledTimes(count);
    expect(prisma.pppoeAccount.findMany.mock.calls[0][0].where.invoices.some.status).toEqual({ in: ['PENDING', 'OVERDUE'] });
    expect(tx.pppoeAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 1n, isActive: true, invoices: { some: { status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lte: new Date('2026-11-10T00:00:00Z') } } },
      paymentPromises: { none: { status: 'ACTIVE', deadline: { gt: new Date('2026-11-11T00:00:00Z') } } },
    }) }));
  });

});

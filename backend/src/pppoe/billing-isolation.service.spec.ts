import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingIsolationService } from './billing-isolation.service.js';

describe('postpaid scheduler activation grace period', () => {
  afterEach(() => vi.useRealTimers());
  it('excludes September activations from September billing and isolation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T03:00:00Z'));
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new BillingIsolationService({ pppoeAccount: { findMany } } as any,
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
    const service = new BillingIsolationService({ pppoeAccount: { findMany }, invoice: { create } } as any,
      { billing: async () => ({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0 }) } as any,
      {} as any, {} as any, {} as any);
    await service.tick();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
});

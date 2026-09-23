import { describe, expect, it } from 'vitest';
import { firstBillingCycle } from './billing-cycle.js';

describe('first postpaid bill', () => {
  it('charges September 23-30 in October, not September', () => {
    const cycle = firstBillingCycle(new Date('2026-09-23T02:00:00Z'), 110000, 10, 'WIB');
    expect(cycle.amount).toBe(29333);
    expect(cycle.dueDate.toISOString()).toBe('2026-10-10T00:00:00.000Z');
  });
  it.each(['2026-02-01', '2028-02-01', '2026-04-01', '2026-01-01'])('charges a full calendar month for %s', date => {
    expect(firstBillingCycle(new Date(`${date}T00:00:00Z`), 100000, 10, 'WIB').amount).toBe(100000);
  });
  it('uses local activation date and crosses the year boundary', () => {
    const cycle = firstBillingCycle(new Date('2026-12-31T17:30:00Z'), 100000, 31, 'WIB');
    expect(cycle.amount).toBe(100000);
    expect(cycle.dueDate.toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });
});

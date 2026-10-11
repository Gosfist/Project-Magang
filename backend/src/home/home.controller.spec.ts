import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HomeController } from './home.controller.js';
import { currentSalaryMonth } from '../finance/salary/finance-salary.service.js';

describe('monthly salary', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-11T05:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it.each([
    ['2026-09-30T16:59:59.999Z', '2026-08-31T17:00:00.000Z', '2026-09-30T17:00:00.000Z'],
    ['2026-09-30T17:00:00.000Z', '2026-09-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z'],
    ['2026-12-31T17:00:00.000Z', '2026-12-31T17:00:00.000Z', '2027-01-31T17:00:00.000Z'],
  ])('uses Jakarta calendar boundaries at %s', (now, start, end) => {
    expect(currentSalaryMonth(new Date(now))).toEqual({ gte: new Date(start), lt: new Date(end) });
  });
  function setup() {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ createdAt: new Date('2026-01-01T00:00:00Z') }) }, mainCore: { count: vi.fn().mockResolvedValue(0) }, psbOrder: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2) },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)) };
    const salary = { settings: vi.fn().mockResolvedValue({ sales: 50000, psb: 100000 }) };
    return { prisma, controller: new HomeController(prisma as any, salary as any) };
  }
  it('scopes registration and completion counts to the logged-in sales user', async () => {
    const { prisma, controller } = setup();
    const result = await controller.stats({ user: { id: '17', role: 'sales' } } as any);
    expect(result).toMatchObject({ monthlyProcessOrders: 3, monthlyCompletedOrders: 2, monthlySalary: 100000 });
    expect(prisma.psbOrder.count).toHaveBeenNthCalledWith(1, { where: { salesUserId: 17n, status: { in: ['PROCESS', 'ACTIVATED'] }, createdAt: { gte: expect.any(Date), lt: expect.any(Date) } } });
    expect(prisma.psbOrder.count).toHaveBeenNthCalledWith(2, { where: { salesUserId: 17n, status: 'COMPLETED', completedAt: { gte: expect.any(Date), lt: expect.any(Date) } } });
  });
  it('pays only completed installations attributed to the current technician', async () => {
    const { prisma, controller } = setup();
    prisma.psbOrder.count.mockReset().mockResolvedValue(2);
    const result = await controller.stats({ user: { id: '19', role: 'teknisi' } } as any);
    expect(result).toMatchObject({ monthlyCompletedOrders: 2, monthlySalary: 200000 });
    expect(prisma.psbOrder.count).toHaveBeenNthCalledWith(1, { where: { completedByUserId: 19n, status: 'COMPLETED', completedAt: { gte: expect.any(Date), lt: expect.any(Date) } } });
  });
  it('filters historical counts using the chosen month rather than the current month', async () => {
    const { prisma, controller } = setup();
    const result = await controller.stats({ user: { id: '17', role: 'sales' } } as any, '2026', '8');
    expect(result).toMatchObject({ year: 2026, month: 8, startYear: 2026, startMonth: 1, monthlySalary: 100000 });
    expect(prisma.psbOrder.count).toHaveBeenNthCalledWith(1, { where: { salesUserId: 17n, status: { in: ['PROCESS', 'ACTIVATED'] }, createdAt: { gte: new Date('2026-07-31T17:00:00Z'), lt: new Date('2026-08-31T17:00:00Z') } } });
  });
  it.each([['2025', '12'], ['9999', '1'], ['2026', '13'], ['abc', '1'], ['2026', '1.5']])('rejects unavailable period %s/%s', async (year, month) => {
    const { prisma, controller } = setup();
    await expect(controller.stats({ user: { id: '17', role: 'sales' } } as any, year, month)).rejects.toThrow('Periode harus');
    expect(prisma.psbOrder.count).not.toHaveBeenCalled();
  });
  it('keeps the account creation month available even when created mid-month', async () => {
    const { prisma, controller } = setup();
    prisma.user.findUnique.mockResolvedValue({ createdAt: new Date('2026-10-11T00:00:00Z') });
    const result = await controller.stats({ user: { id: '17', role: 'sales' } } as any, '2026', '10');
    expect(result).toMatchObject({ startYear: 2026, startMonth: 10 });
    await expect(controller.stats({ user: { id: '17', role: 'sales' } } as any, '2026', '9')).rejects.toThrow('Periode harus');
  });

});

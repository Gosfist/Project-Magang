import { describe, expect, it, vi } from 'vitest';
import { RadiusMonitoringService } from './radius-monitoring.service.js';
describe('RADIUS customer identity', () => {
  it('maps usernames to real customer numbers and names, keeping unknown users blank', async () => {
    const prisma = {
      radpostauth: { findMany: vi.fn().mockResolvedValue([
        { id: 1n, username: 'custom-login', reply: 'Access-Accept', authdate: new Date('2026-10-11T13:00:00Z') },
        { id: 2n, username: 'unknown', reply: 'Access-Reject', authdate: new Date('2026-10-11T12:00:00Z') },
      ]), count: vi.fn().mockResolvedValue(2) },
      pppoeAccount: { findMany: vi.fn().mockResolvedValue([{ username: 'custom-login', customerNumber: 2n, customerName: 'Paijo' }]) },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    const result = await new RadiusMonitoringService(prisma as any).logs();
    expect(result.data[0]).toMatchObject({ customerId: '000002', customerName: 'Paijo' });
    expect(result.data[1]).toMatchObject({ customerId: null, customerName: null });
    expect(result.data[0]).not.toHaveProperty('pass');
    expect(prisma.radpostauth.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, username: true, reply: true, authdate: true, class: true } }));
    expect(prisma.pppoeAccount.findMany).toHaveBeenCalledWith({ where: { username: { in: ['custom-login', 'unknown'] } }, select: { username: true, customerNumber: true, customerName: true } });
  });
});

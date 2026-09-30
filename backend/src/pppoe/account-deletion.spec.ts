import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PppoeService } from './pppoe.service.js';
import { removeCustomerImage } from '../common/image-storage.js';

vi.mock('../common/image-storage.js', () => ({ removeCustomerImage: vi.fn(), uploadsDirectory: () => '/unused' }));

describe('customer deletion', () => {
  beforeEach(() => vi.clearAllMocks());
  function setup() {
    const account = { id: 7n, customerNumber: 42n, customerName: 'Andi', username: 'andi', phone: '08123456789',
      routerNasId: 3, idCardPhoto: '/uploads/ktp/a.jpg' };
    const order = { id: 9n, idCardPhoto: account.idCardPhoto, installationPhoto: '/uploads/instalasi/9.jpg',
      installationFeePaid: 150000n, completedAt: new Date('2026-10-01T03:00:00Z'), completedByUserId: 4n };
    const deletion = () => ({ deleteMany: vi.fn().mockResolvedValue({ count: 1 }) });
    const tx = {
      psbOrder: { ...deletion(), findMany: vi.fn().mockResolvedValue([order]), count: vi.fn().mockResolvedValue(0) },
      invoice: { ...deletion(), create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      collectorDeposit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      radcheck: deletion(), radreply: deletion(), radusergroup: deletion(), radacct: deletion(), radpostauth: deletion(),
      customerAddon: deletion(), paymentPromise: deletion(), activityLog: deletion(), monitoringError: deletion(),
      pppoeAccount: { delete: vi.fn().mockResolvedValue(account), count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 1n }]), $executeRaw: vi.fn().mockResolvedValue(1),
    };
    let committed = false;
    const prisma = {
      pppoeAccount: { findUnique: vi.fn().mockResolvedValue(account), count: vi.fn().mockResolvedValue(0) },
      psbOrder: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(async (action: (client: typeof tx) => Promise<void>) => { await action(tx); committed = true; }),
    };
    const network = { disconnect: vi.fn(async () => { expect(committed).toBe(true); return { warnings: [] as string[] }; }) };
    const service = new PppoeService(prisma as any, {} as any, {} as any, network as any);
    return { service, tx, prisma, network, account };
  }
  it('purges only the target customer and detaches payment history before deleting the account', async () => {
    const { service, tx, network } = setup();
    await service.removeAccount('7');
    for (const model of [tx.radcheck, tx.radreply, tx.radusergroup, tx.radpostauth, tx.radacct]) {
      expect(model.deleteMany).toHaveBeenCalledWith({ where: { username: 'andi' } });
    }
    expect(tx.invoice.deleteMany).toHaveBeenCalledWith({ where: {
      pppoeAccountId: 7n, status: { not: 'PAID' }, paidAt: null, deposits: { none: {} },
    } });
    for (const model of [tx.invoice, tx.collectorDeposit]) {
      expect(model.updateMany).toHaveBeenCalledWith({ where: { pppoeAccountId: 7n }, data: {
        pppoeAccountId: null, customerSnapshot: { id: '7', customerNumber: '42', customerName: 'Andi', username: 'andi', deleted: true },
      } });
    }
    expect(tx.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ invoiceType: 'PSB', status: 'PAID', amount: 150000n }) });
    expect(tx.invoice.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.pppoeAccount.delete.mock.invocationCallOrder[0]);
    expect(tx.psbOrder.deleteMany).toHaveBeenCalledWith({ where: { pppoeAccountId: 7n } });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(network.disconnect).toHaveBeenCalledWith('andi', 3);
    expect(removeCustomerImage).toHaveBeenCalledWith('/uploads/ktp/a.jpg');
    expect(removeCustomerImage).toHaveBeenCalledWith('/uploads/instalasi/9.jpg');
    expect(vi.mocked(removeCustomerImage).mock.calls.filter(([path]) => path === '/uploads/ktp/a.jpg')).toHaveLength(1);
  });
  it('leaves shared files intact', async () => {
    const { service, prisma } = setup();
    prisma.pppoeAccount.count.mockResolvedValue(1);
    await service.removeAccount('7');
    expect(removeCustomerImage).not.toHaveBeenCalled();
  });
  it('preserves WhatsApp logs when another customer uses the same contact', async () => {
    const { service, tx } = setup();
    tx.pppoeAccount.count.mockResolvedValue(1);
    await service.removeAccount('7');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('does not delete files or touch the router when database work fails', async () => {
    const { service, tx, network } = setup();
    tx.invoice.updateMany.mockRejectedValue(new Error('archive failed'));
    await expect(service.removeAccount('7')).rejects.toThrow('archive failed');
    expect(removeCustomerImage).not.toHaveBeenCalled();
    expect(network.disconnect).not.toHaveBeenCalled();
    expect(tx.pppoeAccount.delete).not.toHaveBeenCalled();
  });
  it('continues photo cleanup if router disconnect fails and returns a warning', async () => {
    const { service, network } = setup();
    network.disconnect.mockRejectedValue(new Error('router unreachable'));
    const result = await service.removeAccount('7');
    expect(result.warnings.join(' ')).toContain('router unreachable');
    expect(removeCustomerImage).toHaveBeenCalled();
  });
  it('reports failed file deletion and still cleans other photos', async () => {
    const { service } = setup();
    vi.mocked(removeCustomerImage).mockRejectedValueOnce(new Error('permission denied'));
    const result = await service.removeAccount('7');
    expect(result.warnings.join(' ')).toContain('permission denied');
    expect(removeCustomerImage).toHaveBeenCalledWith('/uploads/instalasi/9.jpg');
  });
});

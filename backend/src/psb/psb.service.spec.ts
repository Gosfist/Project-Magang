import { describe, expect, it, vi } from 'vitest';
import { PsbService } from './psb.service.js';

describe('PSB session status from RADIUS accounting', () => {
  it('preserves online, offline and unknown states instead of turning unknown accounting into offline', async () => {
    const accounts = ['online', 'offline', 'stale', 'missing'].map(username => ({ username, routerNasId: 3 }));
    const orders = [...accounts, null].map((account, index) => ({ id: BigInt(index + 1), customerNumber: BigInt(index + 1), account,
      package: { name: '20 Mb', price: 150000n, costPrice: 0n } }));
    const prisma = { psbOrder: { findMany: vi.fn().mockResolvedValue(orders), count: vi.fn().mockResolvedValue(orders.length) },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)) };
    const warnings = ['Sebagian sesi accounting belum diperbarui.'];
    const network = { accountPresence: vi.fn().mockResolvedValue({ states: new Map([['online', true], ['offline', false], ['stale', null]]), warnings }) };
    const service = new PsbService(prisma as any, {} as any, {} as any, {} as any, {} as any, network as any);
    const result = await service.list({ id: '1', role: 'admin' });
    expect(network.accountPresence).toHaveBeenCalledWith(accounts);
    expect(result.data.map(order => order.internetOnline)).toEqual([true, false, null, null, false]);
    expect(result.warnings).toEqual(warnings);
  });
});

describe('PSB fee paid to technician', () => {
  function setup(fee = 150000) {
    const order = { id: 1n, status: 'ACTIVATED', pppoeAccountId: 2n, customerNumber: 1n,
      customerName: 'Andi', phone: '08123456789', package: { name: '5 Mb', price: 110000n } };
    const prisma = {
      psbOrder: { findUnique: vi.fn().mockResolvedValue(order), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      invoice: { create: vi.fn() },
    };
    const settings = { psb: vi.fn().mockResolvedValue({ installationFee: fee }),
      billing: vi.fn().mockResolvedValue({ billingStartDay: 5, billingEndDay: 10 }) };
    const wa = { notifyPsbCompleted: vi.fn().mockResolvedValue(true) };
    const network = { accountPresence: vi.fn().mockResolvedValue({ states: new Map(), warnings: [] }) };
    const service = new PsbService(prisma as any, {} as any, {} as any, settings as any, wa as any, network as any);
    return { service, prisma, wa };
  }
  it.each([0, 150000])('records Rp%s as received without invoicing the collector', async fee => {
    const { service, prisma, wa } = setup(fee);
    expect(await service.completionSummary('1')).toEqual({ installationFee: fee });
    await service.complete('1', '7', { installationFeePaid: fee });
    expect(prisma.psbOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1n, status: 'ACTIVATED' },
      data: { status: 'COMPLETED', completedByUserId: 7n, completedAt: expect.any(Date), installationFeePaid: BigInt(fee) },
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(wa.notifyPsbCompleted).toHaveBeenCalledTimes(1);
  });
  it('requires confirmation of the current fee', async () => {
    const { service, prisma, wa } = setup();
    await expect(service.complete('1', '7', { installationFeePaid: 100000 })).rejects.toThrow('Biaya PSB berubah');
    expect(prisma.psbOrder.updateMany).not.toHaveBeenCalled();
    expect(wa.notifyPsbCompleted).not.toHaveBeenCalled();
  });
  it('does not notify twice when another request completed the order', async () => {
    const { service, prisma, wa } = setup();
    prisma.psbOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.complete('1', '7', { installationFeePaid: 150000 })).rejects.toThrow('sudah diselesaikan');
    expect(wa.notifyPsbCompleted).not.toHaveBeenCalled();
  });
});

describe('manual technician credential changes', () => {
  function setup() {
    const order = { id: 1n, status: 'ACTIVATED', pppoeAccountId: 2n, installationPhoto: '/uploads/instalasi/1.png' };
    const current = { username: 'old.username', routerNasId: 3 };
    const account = { ...current, id: 2n, username: 'new.username' };
    const tx = {
      pppoeAccount: { findUnique: vi.fn().mockResolvedValue(current), update: vi.fn().mockResolvedValue(account) },
      radacct: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      psbOrder: { update: vi.fn().mockResolvedValue({ ...order, username: 'new.username' }) },
    };
    let committed = false;
    const prisma = {
      psbOrder: { findUnique: vi.fn().mockResolvedValue(order) },
      mainCore: { findFirst: vi.fn().mockResolvedValue({ id: 4n }), findMany: vi.fn().mockResolvedValue([
        { id: 4n, parentId: 5n, tipeTitik: 'odp' }, { id: 5n, parentId: null, tipeTitik: 'server', routerNasId: 3 },
      ]) },
      nas: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      $transaction: async (action: (client: typeof tx) => Promise<unknown>) => { const result = await action(tx); committed = true; return result; },
    };
    const radius = { sync: vi.fn().mockResolvedValue(undefined) };
    const secrets = { encrypt: vi.fn().mockReturnValue('encrypted-new') };
    const network = { disconnect: vi.fn().mockImplementation(async () => {
      expect(committed).toBe(true);
      return { warnings: [] };
    }) };
    const service = new PsbService(prisma as any, radius as any, secrets as any, {} as any, {} as any, network as any);
    return { service, tx, radius, network, account };
  }
  it.each(['', 'new-password'])('saves a username change with password %s and disconnects only after commit', async password => {
    const { service, tx, radius, network, account } = setup();
    await service.activate('1', { username: 'new.username', password: password || undefined, odp: '4' }, '7');
    const data = tx.pppoeAccount.update.mock.calls[0][0].data;
    expect(data.username).toBe('new.username');
    if (password) expect(data.password).toBe('encrypted-new');
    else expect(data).not.toHaveProperty('password');
    expect(radius.sync).toHaveBeenCalledWith(tx, account, 'old.username');
    expect(network.disconnect).toHaveBeenCalledWith('old.username', 3);
    expect(tx.radacct.updateMany).not.toHaveBeenCalled();
  });
  it('does not send Disconnect or manufacture Accounting-Stop if RADIUS synchronization rolls back', async () => {
    const { service, radius, network, tx } = setup();
    radius.sync.mockRejectedValue(new Error('RADIUS update failed'));
    await expect(service.activate('1', { username: 'new.username', odp: '4' }, '7')).rejects.toThrow('RADIUS update failed');
    expect(network.disconnect).not.toHaveBeenCalled();
    expect(tx.radacct.updateMany).not.toHaveBeenCalled();
  });
});

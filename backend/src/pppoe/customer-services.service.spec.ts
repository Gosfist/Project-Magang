import type { PrismaService } from '../prisma/prisma.service.js';
import type { RadiusService } from './radius.service.js';
import type { PppoeNetworkService } from './pppoe-network.service.js';
import { calendarDate, CustomerServicesService, promiseDeadline } from './customer-services.service.js';

function setup() {
  const account = { id: 1n, username: 'suro', isActive: true, expiresAt: null as Date | null, routerNasId: 3, package: { isActive: true, validityDays: 30 } };
  let promise: any = null;
  let committed = false;
  const tx = {
    pppoeAccount: { findUnique: vi.fn(async () => account), update: vi.fn(async ({ data }) => Object.assign(account, data)) },
    invoice: { findMany: vi.fn(async () => [{ id: 10n, status: 'PENDING' }]), create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null), update: vi.fn() },
    customerAddon: { create: vi.fn(async () => ({})) },
    paymentPromise: {
      findFirst: vi.fn(async ({ where }) => promise && (typeof where.status === 'string' ? promise.status === where.status : where.status.in.includes(promise.status)) && (!where.disconnectPending || promise.disconnectPending) ? promise : null),
      create: vi.fn(async ({ data }) => { promise = { ...data, id: 2n, status: 'ACTIVE' }; return promise; }),
      update: vi.fn(async ({ data }) => Object.assign(promise, data)),
    },
  };
  const prisma = { ...tx, radpostauth: { findMany: vi.fn(async () => []) }, $transaction: vi.fn(async action => { const result = await action(tx); committed = true; return result; }) };
  const radius = { sync: vi.fn(async () => {}) };
  const network = { disconnect: vi.fn(async () => { expect(committed).toBe(true); return { warnings: [] as string[] }; }) };
  const service = new CustomerServicesService(prisma as unknown as PrismaService, radius as unknown as RadiusService, network as unknown as PppoeNetworkService);
  return { service, tx, prisma, radius, network, account, promise: () => promise };
}
describe('Customer invoices and promises', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-17T02:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('uses the end of the requested WIB date and rejects invalid calendar dates', () => {
    expect(promiseDeadline('2026-09-18').toISOString()).toBe('2026-09-18T17:00:00.000Z');
    expect(() => calendarDate('2026-02-30')).toThrow('Tanggal tidak valid');
  });
  it('selects only the last ten auth results for this username, never passwords', async () => {
    const { service, prisma } = setup();
    await service.authLogs('1');
    expect(prisma.radpostauth.findMany).toHaveBeenCalledWith({ where: { username: 'suro' }, select: { id: true, reply: true, authdate: true }, take: 10, orderBy: [{ authdate: 'desc' }, { id: 'desc' }] });
  });
  it('creates an add-on and its invoice in one transaction', async () => {
    const { service, tx } = setup();
    await service.createAddon('1', { name: 'Sewa router', amount: 25000, dueDate: '2026-09-20' });
    const invoice = tx.invoice.create.mock.calls[0][0].data;
    expect(invoice).toMatchObject({ amount: 25000n, pppoeAccountId: 1n, invoiceType: 'ADDON' });
    expect(tx.customerAddon.create.mock.calls[0][0].data.invoiceNumber).toBe(invoice.invoiceNumber);
  });
  it('opens access, captures unpaid invoice IDs and rejects duplicate promises', async () => {
    const { service, account, promise, radius } = setup(); account.isActive = false;
    await service.createPromise('1', { promisedDate: '2026-09-18' });
    expect(account.isActive).toBe(true); expect(promise().invoiceIds).toEqual(['10']); expect(radius.sync).toHaveBeenCalled();
    await expect(service.createPromise('1', { promisedDate: '2026-09-19' })).rejects.toThrow('Masih ada');
  });
  it('rejects a promise without an unpaid invoice or with a past date', async () => {
    const { service, tx } = setup(); tx.invoice.findMany.mockResolvedValue([]);
    await expect(service.createPromise('1', { promisedDate: '2026-09-18' })).rejects.toThrow('Tidak ada tagihan');
    await expect(service.createPromise('1', { promisedDate: '2026-09-16' })).rejects.toThrow('minimal hari ini');
  });
  it('isolates at the exact deadline, syncs RADIUS, then disconnects; retries failed NAS', async () => {
    const { service, promise, account, radius, network } = setup();
    await service.createPromise('1', { promisedDate: '2026-09-18' });
    vi.setSystemTime(new Date('2026-09-18T16:59:59Z')); await service.reconcileAccount(1n);
    expect(account.isActive).toBe(true); expect(network.disconnect).not.toHaveBeenCalled();
    network.disconnect.mockResolvedValueOnce({ warnings: ['Router offline'] });
    vi.setSystemTime(new Date('2026-09-18T17:00:00Z')); await service.reconcileAccount(1n);
    expect(account.isActive).toBe(false); expect(promise()).toMatchObject({ status: 'EXPIRED', disconnectPending: true });
    expect(radius.sync).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ isActive: false }));
    await service.reconcileAccount(1n); expect(network.disconnect).toHaveBeenCalledTimes(2); expect(promise().disconnectPending).toBe(false);
  });
  it('marks a fully paid promise fulfilled and does not disconnect', async () => {
    const { service, promise, tx, network, account } = setup();
    account.expiresAt = new Date('2026-09-10');
    await service.createPromise('1', { promisedDate: '2026-09-18' });
    tx.invoice.findMany.mockResolvedValue([{ id: 10n, status: 'PAID' }]);
    await service.reconcileAccount(1n);
    expect(promise().status).toBe('FULFILLED'); expect(account.expiresAt!.getTime()).toBeGreaterThan(Date.now()); expect(network.disconnect).not.toHaveBeenCalled();
  });
  it('does not mark another customer invoice paid', async () => {
    const { service, tx } = setup();
    await expect(service.payInvoice('1', '90')).rejects.toThrow('Tagihan tidak ditemukan');
    expect(tx.invoice.findFirst).toHaveBeenCalledWith({ where: { id: 90n, pppoeAccountId: 1n } }); expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});

import type { PrismaService } from '../prisma/prisma.service.js';
import type { RadiusService } from './radius.service.js';
import type { SecretService } from './secret.service.js';
import type { PppoeNetworkService } from './pppoe-network.service.js';
import { PppoeService } from './pppoe.service.js';
import type { SaveAccountDto } from './pppoe.dto.js';
vi.mock('./id-card-photo.js', () => ({ validateIdCardPhoto: vi.fn().mockResolvedValue(undefined) }));

describe('PPPoE billing and account deactivation', () => {
  function setup() {
    const pkg = { id: 1n, price: 300000n, costPrice: 0n, validityDays: 30, isActive: true };
    const current = { id: 2n, username: 'andi', password: 'encrypted', routerNasId: 3, isActive: true };
    const invoice = { create: vi.fn().mockResolvedValue({}) };
    const tx = {
      invoice,
      pppoeAccount: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 2n, package: pkg })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...current, ...data, package: pkg })),
      },
    };
    let committed = false;
    const prisma = {
      mainCore: { findFirst: vi.fn().mockResolvedValue({ id: 4n }) },
      pppoePackage: { findUnique: vi.fn().mockResolvedValue(pkg) },
      pppoeAccount: { findUnique: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn().mockImplementation(async (action) => { const result = await action(tx); committed = true; return result; }),
    };
    const radius = { sync: vi.fn().mockResolvedValue(undefined) };
    const secrets = { encrypt: () => 'encrypted' };
    const network = { disconnect: vi.fn().mockImplementation(async () => {
      expect(committed).toBe(true); // Router action must follow RADIUS commit.
      return { completed: 1, warnings: [] };
    }) };
    const service = new PppoeService(prisma as unknown as PrismaService, radius as unknown as RadiusService, secrets as unknown as SecretService, network as unknown as PppoeNetworkService);
    const dto = { pppoePackageId: '1', customerName: 'Andi', username: 'andi', password: 'password', subscriptionType: 'PREPAID', billingDay: 1, discount: 10000, routerNasId: '3', firstInvoice: 'prorate', isActive: true } as SaveAccountDto;
    Object.assign(dto, { phone: '08123456789', idCardNumber: '1234567890123456', idCardPhoto: 'id-cards/test.png', latitude: 0, longitude: 0, address: 'Alamat pelanggan', odp: '4' });
    return { service, dto, invoice, network, radius, tx, prisma };
  }
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 16, 0, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('charges prepaid the full discounted price even for stale prorate payloads', async () => {
    const { service, dto, invoice } = setup();
    await service.createAccount(dto);
    expect(invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 290000n, invoiceType: 'MONTHLY' }) });
  });
  it('prorates postpaid only', async () => {
    const { service, dto, invoice } = setup();
    await service.createAccount({ ...dto, subscriptionType: 'POSTPAID' });
    expect(invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 145000n, invoiceType: 'PRORATE' }) });
  });
  it('does not create a first invoice when none is requested', async () => {
    const { service, dto, invoice } = setup();
    await service.createAccount({ ...dto, firstInvoice: 'none' });
    expect(invoice.create).not.toHaveBeenCalled();
  });
  it('charges full postpaid when full is selected', async () => {
    const { service, dto, invoice } = setup();
    await service.createAccount({ ...dto, subscriptionType: 'POSTPAID', firstInvoice: 'full' });
    expect(invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 290000n, invoiceType: 'MONTHLY' }) });
  });
  it('disconnects after committing deactivation and allows retrying an inactive account', async () => {
    const { service, dto, network, radius } = setup();
    await service.updateAccount('2', { ...dto, isActive: false });
    expect(radius.sync).toHaveBeenCalled();
    expect(network.disconnect).toHaveBeenCalledWith('andi', 3);
  });
  it('keeps deactivation saved and exposes failed disconnect as a warning', async () => {
    const { service, dto, network, tx } = setup();
    network.disconnect.mockResolvedValue({ completed: 0, warnings: ['NAS tidak terjangkau'] });
    const response = await service.updateAccount('2', { ...dto, isActive: false });
    expect(tx.pppoeAccount.update).toHaveBeenCalled();
    expect(response).toMatchObject({ warnings: ['NAS tidak terjangkau'] });
  });
  it('does not create duplicate invoices on edits', async () => {
    const { service, dto, invoice, network } = setup();
    await service.updateAccount('2', dto);
    expect(invoice.create).not.toHaveBeenCalled();
    expect(network.disconnect).not.toHaveBeenCalled();
  });
  it.each(['phone', 'idCardNumber', 'idCardPhoto', 'address'] as const)('rejects creating a customer with blank %s', async field => {
    const { service, dto, tx } = setup();
    await expect(service.createAccount({ ...dto, [field]: '  ' })).rejects.toThrow('Seluruh data pelanggan');
    expect(tx.pppoeAccount.create).not.toHaveBeenCalled();
  });
  it('rejects absent coordinates but accepts zero coordinates', async () => {
    const { service, dto, tx } = setup();
    await expect(service.createAccount({ ...dto, latitude: undefined })).rejects.toThrow('Seluruh data pelanggan');
    await service.createAccount(dto);
    expect(tx.pppoeAccount.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ latitude: 0, longitude: 0 }) }));
  });
  it('requires a real ODP on create and edit', async () => {
    const { service, dto, prisma, tx } = setup();
    await expect(service.createAccount({ ...dto, odp: '' })).rejects.toThrow('ODP wajib');
    prisma.mainCore.findFirst.mockResolvedValue(null as never);
    await expect(service.updateAccount('2', dto)).rejects.toThrow('ODP tidak ditemukan');
    expect(tx.pppoeAccount.update).not.toHaveBeenCalled();
  });
});

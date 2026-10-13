import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { BackupService } from './backup.service.js';
import { HEADERS, parseWorkbook, table } from './backup-workbook.js';

async function file(values: Record<string, string>[], formula = false) {
  const book = new ExcelJS.Workbook();
  const sheet = table(book, 'Akun PPPoE', HEADERS, values.map(row => HEADERS.map(key => row[key] || '')));
  if (formula) sheet.getCell('D2').value = { formula: '1+1', result: 2 };
  return Buffer.from(await book.xlsx.writeBuffer());
}
const row = { no_pelanggan: '000123', nama_pelanggan: 'Contoh', username: 'customer', password: '=$special"\\password', paket: 'Paket 10', router_id: '3', area_id: '4', odp_id: '5', no_wa: '081234567', no_ktp: '0123456789', jenis_langganan: 'POSTPAID', tanggal_tagihan: '10', diskon: '0', aktif: 'YA', berlaku_sampai: '2026-12-01' };
function setup() {
  const secrets = new SecretService(new ConfigService({ JWT_SECRET: 'unit-test-secret-only' }));
  const state = { accounts: [] as any[], settings: [] as any[] };
  const pkg = { id: 2n, name: 'Paket 10', uploadMbps: 5, downloadMbps: 10, addressPool: 'internet', isActive: true };
  const prisma = {
    pppoePackage: { findMany: vi.fn(async () => [pkg]) },
    nas: { findUnique: vi.fn(async ({ where }) => where.id === 3 ? { id: 3 } : null), findMany: vi.fn(async () => [{ id: 3, name: 'Router Uji', nasname: '10.0.0.1', isActive: true, _count: { accounts: state.accounts.length } }]) },
    area: { findMany: vi.fn(async () => [{ id: 4n, name: 'Area Uji' }]) },
    mainCore: { findMany: vi.fn(async () => [{ id: 5n, namaTitik: 'ODP Uji' }]) },
    psbOrder: { findMany: vi.fn(async () => []) }, paymentPromise: { updateMany: vi.fn(async () => ({})) },
    appSetting: { findMany: vi.fn(async () => state.settings), findUnique: vi.fn(async ({ where }) => state.settings.find(row => row.key === where.key) || null), upsert: vi.fn(async ({ create }) => { state.settings.push(create); }) },
    pppoeAccount: {
      findMany: vi.fn(async ({ where }: any = {}) => state.accounts.filter(account => !where?.routerNasId || account.routerNasId === where.routerNasId)), count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => { const account = { ...data, id: BigInt(state.accounts.length + 1), package: pkg }; state.accounts.push(account); return account; }),
      update: vi.fn(async ({ where, data }) => { const account = state.accounts.find(account => account.id === where.id); Object.assign(account, data); return account; }),
    },
    $transaction: vi.fn(async action => { const before = structuredClone(state); try { return await action(prisma); } catch (error) { Object.assign(state, before); throw error; } }),
  };
  const radius = { sync: vi.fn(async () => ({})) };
  const service = new BackupService(prisma as any, secrets, radius as any, new JwtService({ secret: 'preview-test-key' }));
  return { service, state, prisma, radius, secrets, pkg };
}

describe('PPPoE backup Excel and restoration', () => {
  it('downloads a blank import template with separate example and reference sheets', async () => {
    const { service } = setup(); const result = await service.workbook(true);
    const book = new ExcelJS.Workbook(); await book.xlsx.read(result.getStream());
    expect(book.getWorksheet('Akun PPPoE')!.getRow(1).values).toEqual([undefined, ...HEADERS]);
    expect(book.getWorksheet('Contoh')).toBeDefined(); expect(book.getWorksheet('Referensi Router')).toBeDefined();
    expect(book.getWorksheet('Akun PPPoE')!.getCell('A2').text).toBe('');
  });
  it('previews without writes or passwords then atomically imports and encrypts credentials', async () => {
    const { service, prisma, radius, state, secrets } = setup(); const buffer = await file([row]);
    const preview = await service.preview(buffer, 'create', 'admin1');
    expect(preview).toMatchObject({ total: 1, create: 1, update: 0, errors: [] });
    expect(JSON.stringify(preview)).not.toContain(row.password); expect(prisma.pppoeAccount.create).not.toHaveBeenCalled();
    await service.import(buffer, { mode: 'create', token: preview.token! }, 'admin1');
    expect(state.accounts[0].customerNumber).toBe(123n);
    expect(state.accounts[0].password).not.toBe(row.password); expect(secrets.decrypt(state.accounts[0].password)).toBe(row.password);
    expect(radius.sync).toHaveBeenCalledOnce();
    const output = await service.workbook(false, 3); const book = new ExcelJS.Workbook(); await book.xlsx.read(output.getStream());
    expect(book.getWorksheet('Akun PPPoE')!.getCell('A2').value).toBe('000123');
    expect(book.getWorksheet('Akun PPPoE')!.getCell('D2').value).toBe(row.password);
  });
  it('rejects duplicate customer numbers regardless of leading zeros before any import', async () => {
    const { service, prisma } = setup(); const buffer = await file([row, { ...row, no_pelanggan: '123', username: 'other', no_wa: '', no_ktp: '' }]);
    const preview = await service.preview(buffer, 'create', '1');
    expect(preview.token).toBeNull(); expect(preview.errors[0]).toMatchObject({ row: 3 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('requires the same file, mode, actor, and server state as the reviewed preview', async () => {
    const { service, state } = setup(); const buffer = await file([row]);
    const preview = await service.preview(buffer, 'create', '1');
    await expect(service.import(buffer, { mode: 'create', token: preview.token! }, '2')).rejects.toThrow('berbeda');
    await expect(service.import(await file([{ ...row, password: 'changed' }]), { mode: 'create', token: preview.token! }, '1')).rejects.toThrow('berbeda');
    state.accounts.push({ id: 9n, customerNumber: 456n, username: 'other', updatedAt: new Date() });
    await expect(service.import(buffer, { mode: 'create', token: preview.token! }, '1')).rejects.toThrow('Data server berubah');
    expect(state.accounts).toHaveLength(1);
  });
  it('supports reviewed updates while preserving fields outside the account workbook', async () => {
    const { service, state, secrets, pkg } = setup();
    state.accounts.push({ id: 1n, username: row.username, customerNumber: 123n, phone: row.no_wa, idCardNumber: row.no_ktp, password: secrets.encrypt('old'), updatedAt: new Date('2026-10-01'), package: pkg, idCardPhoto: '/uploads/ktp/kept.png' });
    const buffer = await file([row]);
    expect((await service.preview(buffer, 'create', '1')).token).toBeNull();
    const preview = await service.preview(buffer, 'upsert', '1'); expect(preview.update).toBe(1);
    await service.import(buffer, { mode: 'upsert', token: preview.token! }, '1');
    expect(state.accounts).toHaveLength(1); expect(state.accounts[0].idCardPhoto).toBe('/uploads/ktp/kept.png');
    expect(secrets.decrypt(state.accounts[0].password)).toBe(row.password);
  });
  it('rolls back every imported row if RADIUS synchronization fails', async () => {
    const { service, state, radius } = setup();
    const buffer = await file([row, { ...row, no_pelanggan: '124', username: 'second', no_wa: '', no_ktp: '' }]);
    const preview = await service.preview(buffer, 'create', '1');
    radius.sync.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('DB failed'));
    await expect(service.import(buffer, { mode: 'create', token: preview.token! }, '1')).rejects.toThrow('DB failed');
    expect(state.accounts).toHaveLength(0);
  });
  it.each([{ router_id: '99' }, { area_id: '99' }, { berlaku_sampai: '2026-02-31' }, { aktif: '' }])('reports invalid reference/date/status %j', async change => {
    const { service } = setup(); const preview = await service.preview(await file([{ ...row, ...change }]), 'create', '1');
    expect(preview.token).toBeNull(); expect(preview.errors).toHaveLength(1);
  });
  it('rejects formulas, invalid archives and excessive expanded ZIP size', async () => {
    await expect(parseWorkbook(await file([row], true))).rejects.toThrow('tanpa formula');
    await expect(parseWorkbook(Buffer.from('not Excel'))).rejects.toThrow('.xlsx');
    const buffer = await file([row]); const central = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buffer.writeUInt32LE(30 * 1024 * 1024, central + 24);
    await expect(parseWorkbook(buffer)).rejects.toThrow('terlalu besar');
    const understated = await file([row]); const understatedCentral = understated.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    understated.writeUInt32LE(1, understatedCentral + 24);
    await expect(parseWorkbook(understated)).rejects.toThrow('arsip Excel tidak valid');
  });
  it('generates router scripts from the database even if the MikroTik is offline', async () => {
    const { service, state, secrets, pkg } = setup();
    state.settings.push({ key: 'pppoe_backup_router_3', value: JSON.stringify({ localAddress: '192.168.75.1', baseProfile: 'default' }) });
    state.accounts.push({ id: 1n, customerNumber: 1n, username: 'test', password: secrets.encrypt('password'), package: pkg, pppoePackageId: 2n, isActive: true, routerNasId: 3, paymentPromises: [] });
    const stream = (await service.script(3, 'local', false)).getStream(); const parts: Buffer[] = []; for await (const part of stream) parts.push(Buffer.from(part));
    expect(Buffer.concat(parts).toString()).toContain('remote-address="internet"');
  });
});

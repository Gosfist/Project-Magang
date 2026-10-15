import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { validate } from 'class-validator';
import { PaketLayananService } from './paket-layanan.service.js';
import { PublicPackagesController } from './public-packages.controller.js';
import { SavePackageDto } from './paket-layanan.dto.js';

function setup() {
  const rows = new Map([1n, 2n, 3n, 4n].map(id => [id, {
    id, name: `Paket ${id}`, price: id * 50000n, costPrice: 1n, downloadMbps: Number(id) * 10,
    uploadMbps: 2, addressPool: null, ipPool: null, validityDays: 30, isActive: id !== 4n,
  }]));
  let popular: string | null = null;
  const appSetting = {
    findUnique: vi.fn(async () => popular === null ? null : { value: popular }),
    upsert: vi.fn(async ({ update }) => { popular = update.value; }),
    deleteMany: vi.fn(async ({ where }) => { if (popular === where.value) popular = null; }),
  };
  const pppoePackage = {
    findUnique: vi.fn(async ({ where }) => rows.get(where.id)),
    findMany: vi.fn(async ({ where }) => [...rows.values()].filter(row => row.isActive === where.isActive)),
    update: vi.fn(async ({ where, data }) => {
      expect(data).not.toHaveProperty('isPopular');
      const row = { ...rows.get(where.id)!, ...data }; rows.set(where.id, row); return row;
    }),
    create: vi.fn(async ({ data }) => { const row = { ...data, id: 5n }; rows.set(5n, row); return row; }),
    delete: vi.fn(async ({ where }) => rows.delete(where.id)),
  };
  const prisma = {
    appSetting, pppoePackage,
    pppoeAccount: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    $transaction: vi.fn(async action => {
      if (Array.isArray(action)) return Promise.all(action);
      const savedRows = new Map(rows); const savedPopular = popular;
      try { return await action(prisma); }
      catch (error) { rows.clear(); savedRows.forEach((row, id) => rows.set(id, row)); popular = savedPopular; throw error; }
    }),
  };
  const network = { disconnect: vi.fn() };
  const service = new PaketLayananService(prisma as any, {} as any, {} as any, network as any);
  const dto = { name: 'Paket', price: 100000, costPrice: 0, downloadMbps: 20, uploadMbps: 2, validityDays: 30 };
  return { service, prisma, network, dto };
}

describe('Public pricing and the single popular package', () => {
  let app: INestApplication | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it('moves popularity from A to B and an unselected A cannot clear B', async () => {
    const { service, dto } = setup();
    await service.updatePackage('1', { ...dto, isPopular: true });
    await service.updatePackage('2', { ...dto, isPopular: true });
    await service.updatePackage('1', { ...dto, isPopular: false });
    expect((await service.publicPackages()).data.filter(row => row.isPopular).map(row => row.id)).toEqual(['2']);
    await service.updatePackage('2', { ...dto, isPopular: false });
    expect((await service.publicPackages()).data.some(row => row.isPopular)).toBe(false);
  });

  it('leaves at most one selection when admins save concurrently', async () => {
    const { service, dto } = setup();
    await Promise.all([1, 2, 3].map(id => service.updatePackage(String(id), { ...dto, isPopular: true })));
    expect((await service.publicPackages()).data.filter(row => row.isPopular)).toHaveLength(1);
  });

  it('supports creating a popular package and clears its setting on deletion', async () => {
    const { service, prisma, dto } = setup();
    await service.createPackage({ ...dto, isPopular: true });
    expect((await service.publicPackages()).data.find(row => row.id === '5')?.isPopular).toBe(true);
    await service.removePackage('5');
    expect(await prisma.appSetting.findUnique()).toBeNull();
  });

  it('rolls back the package when saving popularity fails', async () => {
    const { service, prisma, dto } = setup();
    prisma.appSetting.upsert.mockRejectedValueOnce(new Error('Write failed'));
    await expect(service.updatePackage('1', { ...dto, isPopular: true })).rejects.toThrow('Write failed');
    expect((await service.publicPackages()).data[0].price).toBe(50000);
  });

  it('keeps popularity when an older client omits the optional checkbox', async () => {
    const { service, network, dto } = setup();
    await service.updatePackage('2', { ...dto, isPopular: true });
    await service.updatePackage('2', { ...dto, price: 120000 });
    expect((await service.publicPackages()).data.find(row => row.id === '2')).toMatchObject({ isPopular: true, price: 120000 });
    expect(network.disconnect).not.toHaveBeenCalled();
  });

  it('serves active packages without login and exposes only public fields', async () => {
    const { service } = setup();
    const module = await Test.createTestingModule({ controllers: [PublicPackagesController],
      providers: [{ provide: PaketLayananService, useValue: service }] }).compile();
    app = module.createNestApplication();
    await app.init();
    const result = await request(app.getHttpServer()).get('/public/packages').expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.data).toHaveLength(3);
    expect(result.body.data[0]).toEqual({ id: '1', name: 'Paket 1', price: 50000, downloadMbps: 10, isPopular: false });
    await request(app.getHttpServer()).post('/public/packages').send({ isPopular: true }).expect(404);
  });

  it('rejects non-boolean popularity values', async () => {
    const { dto } = setup();
    const errors = await validate(Object.assign(new SavePackageDto(), dto, { isPopular: 'false' }));
    expect(errors.map(error => error.property)).toContain('isPopular');
  });
});

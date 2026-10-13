import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { FinanceInvoicesController } from '../finance/invoices/finance-invoices.controller.js';
import { FinanceInvoicesService } from '../finance/invoices/finance-invoices.service.js';
import { FinanceDepositsController } from '../finance/deposits/finance-deposits.controller.js';
import { FinanceDepositsService } from '../finance/deposits/finance-deposits.service.js';
import { AreaController } from '../area/area.controller.js';
import { AreaService } from '../area/area.service.js';
import { IsolationController } from '../pppoe/isolation/isolation.controller.js';
import { IsolationService } from '../pppoe/isolation/isolation.service.js';
import { BackupController } from '../tools/backup/backup.controller.js';
import { BackupService } from '../tools/backup/backup.service.js';

describe('Role access over HTTP', () => {
  let app: INestApplication;
  let role = 'admin';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceInvoicesController, FinanceDepositsController, AreaController, IsolationController, BackupController],
      providers: [
        { provide: BackupService, useValue: { options: () => ({}), workbook: () => ({}), script: () => ({}), preview: () => ({}), import: () => ({}) } },
        { provide: IsolationService, useValue: { get: () => ({}), save: () => ({}), sync: () => ({}), status: () => ({}) } },
        { provide: FinanceInvoicesService, useValue: { invoiceOverview: () => ({}), unpaidInvoices: () => ({}) } },
        { provide: FinanceDepositsService, useValue: { list: () => ({}), accept: () => ({}) } },
        { provide: AreaService, useValue: { list: () => ({}), options: () => ({}), getCollectorCustomers: () => ({}) } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = { id: '1', role };
      return true;
    } }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('marks account backup downloads private and non-cacheable', async () => {
    role = 'admin';
    await request(app.getHttpServer()).get('/settings/backup/excel').expect(200).expect('Cache-Control', 'private, no-store');
  });
  it('rejects oversized account import files before the backup service runs', async () => {
    role = 'admin';
    await request(app.getHttpServer()).post('/settings/backup/preview').field('mode', 'create').attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.xlsx').expect(413);
  });
  for (const currentRole of ['admin', 'finance', 'kolektor', 'sales', 'teknisi']) {
    it(`checks direct API access for ${currentRole}`, async () => {
      role = currentRole;
      await request(app.getHttpServer()).get('/finance/deposits/invoices').expect(['admin', 'finance'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).get('/finance/deposits').expect(['admin', 'finance', 'kolektor'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).patch('/finance/deposits/1/accept').expect(['admin', 'finance'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).get('/areas').expect(role === 'admin' ? 200 : 403);
      await request(app.getHttpServer()).get('/areas/customers').expect(['admin', 'kolektor'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).get('/areas/options').expect(['admin', 'sales', 'teknisi'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).get('/pppoe/isolation/3').expect(role === 'admin' ? 200 : 403);
      await request(app.getHttpServer()).post('/pppoe/isolation/3/sync').expect(role === 'admin' ? 201 : 403);
      await request(app.getHttpServer()).get('/settings/backup/options').expect(role === 'admin' ? 200 : 403);
      await request(app.getHttpServer()).get('/settings/backup/excel').expect(role === 'admin' ? 200 : 403);
      await request(app.getHttpServer()).post('/settings/backup/router/3/script').send({ mode: 'local', reconnect: false }).expect(role === 'admin' ? 201 : 403);
      await request(app.getHttpServer()).post('/settings/backup/import').field('mode', 'create').expect(role === 'admin' ? 201 : 403);
    });
  }
});

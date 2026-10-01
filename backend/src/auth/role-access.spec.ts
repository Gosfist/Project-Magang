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

describe('Role access over HTTP', () => {
  let app: INestApplication;
  let role = 'admin';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceInvoicesController, FinanceDepositsController, AreaController],
      providers: [
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
  for (const currentRole of ['admin', 'finance', 'kolektor', 'sales', 'teknisi']) {
    it(`checks direct API access for ${currentRole}`, async () => {
      role = currentRole;
      await request(app.getHttpServer()).get('/finance/deposits/invoices').expect(role === 'finance' ? 200 : 403);
      await request(app.getHttpServer()).get('/finance/deposits').expect(['finance', 'kolektor'].includes(role) ? 200 : 403);
      await request(app.getHttpServer()).patch('/finance/deposits/1/accept').expect(role === 'finance' ? 200 : 403);
      await request(app.getHttpServer()).get('/areas').expect(role === 'admin' ? 200 : 403);
      await request(app.getHttpServer()).get('/areas/customers').expect(role === 'kolektor' ? 200 : 403);
      await request(app.getHttpServer()).get('/areas/options').expect(['admin', 'sales', 'teknisi'].includes(role) ? 200 : 403);
    });
  }
});

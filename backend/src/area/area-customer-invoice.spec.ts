import { describe, it, expect, vi } from 'vitest';
import { AreaService } from './area.service.js';
describe('collector displayed invoice', () => {
  it.each(['PAID', 'PENDING'])('keeps %s invoice amount and date visible without allowing paid invoices as active', async status => {
    const invoice = { id: 8n, amount: 110000n, dueDate: new Date('2026-11-10T00:00:00Z'), status, invoiceNumber: 'INV/202610/000001', deposits: [] };
    const account = { id: 1n, customerNumber: 1n, customerName: 'Andi', invoices: [invoice], paymentPromises: [], subscriptionType: 'POSTPAID' };
    const prisma = { area: { findUnique: vi.fn().mockResolvedValue({ id: 1n, name: 'Area' }) },
      areaCollector: { findMany: vi.fn().mockResolvedValue([]) },
      pppoeAccount: { findMany: vi.fn().mockResolvedValueOnce([account]).mockResolvedValueOnce([{ id: 1n, invoices: status === 'PAID' ? [] : [invoice] }]) } };
    const result = await new AreaService(prisma as any).getAreaCustomers('1');
    expect(result.customers[0]).toMatchObject({ displayInvoice: { id: '8', amount: 110000, dueDate: invoice.dueDate.toISOString() }, isPaid: status === 'PAID' });
    if (status === 'PAID') expect(result.customers[0].activeInvoice).toBeNull();
    else expect(result.customers[0].activeInvoice).toMatchObject({ id: '8' });
  });
});

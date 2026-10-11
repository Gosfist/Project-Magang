import { describe, expect, it, vi } from 'vitest';
import { FinanceSalaryService } from './finance-salary.service.js';
import { PengaturanService } from '../../tools/pengaturan/pengaturan.service.js';

describe('shared installation fee and technician salary', () => {
  function setup() {
    const values = new Map([['biaya_psb', '150000'], ['gaji_psb', '0'], ['gaji_sales', '50000']]);
    const prisma = {
      appSetting: {
        findMany: vi.fn(async ({ where }: any) => [...values].filter(([key]) => typeof where.key === 'string' ? key === where.key : where.key.in.includes(key)).map(([key, value]) => ({ key, value }))),
        upsert: vi.fn(async ({ where, update }: any) => { values.set(where.key, update.value); return { key: where.key, value: update.value }; }),
      },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    return { values, finance: new FinanceSalaryService(prisma as any), admin: new PengaturanService(prisma as any) };
  }
  it('reads the administrator fee instead of the obsolete salary key', async () => {
    const { finance } = setup();
    expect(await finance.settings()).toEqual({ psb: 150000, sales: 50000 });
  });
  it('reflects Finance edits in administrator PSB settings', async () => {
    const { finance, admin, values } = setup();
    await finance.update({ psb: 200000, sales: 60000 });
    expect(await admin.psb()).toEqual({ installationFee: 200000 });
    expect(await finance.settings()).toEqual({ psb: 200000, sales: 60000 });
    expect(values.get('gaji_psb')).toBe('0');
  });
  it('reflects administrator edits in Finance without changing Sales salary', async () => {
    const { finance, admin } = setup();
    await admin.updateBilling({ billingStartDay: 5, billingEndDay: 10, billingTimezone: 'WIB', isolationCheckHour: 0, psbFee: 250000 });
    expect(await finance.settings()).toEqual({ psb: 250000, sales: 50000 });
  });
});

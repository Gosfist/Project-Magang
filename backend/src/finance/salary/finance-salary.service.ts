import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SalarySettingsDto } from './finance-salary.dto.js';

export function currentSalaryMonth(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = local.getUTCFullYear(), month = local.getUTCMonth();
  return salaryMonth(year, month + 1);
}
export function salaryMonth(year: number, month: number) {
  return { gte: new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000),
    lt: new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000) };
}
@Injectable()
export class FinanceSalaryService {
  constructor(private readonly prisma: PrismaService) {}
  async settings() {
    const rows = await this.prisma.appSetting.findMany({ where: { key: { in: ['biaya_psb', 'gaji_sales'] } } });
    const values = new Map(rows.map(row => [row.key, row.value]));
    return { psb: Number(values.get('biaya_psb') || 0), sales: Number(values.get('gaji_sales') || 0) };
  }
  async update(dto: SalarySettingsDto) {
    await this.prisma.$transaction([['biaya_psb', dto.psb], ['gaji_sales', dto.sales]].map(([key, amount]) =>
      this.prisma.appSetting.upsert({ where: { key: String(key) }, create: { key: String(key), value: String(amount) }, update: { value: String(amount) } })));
    return { message: 'Pengaturan gaji berhasil disimpan.', data: dto };
  }
}

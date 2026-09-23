import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BillingSettingsDto } from './settings.dto.js';

export interface BillingSettings {
  billingStartDay: number;
  billingEndDay: number;
  billingTimezone: 'WIB' | 'WITA' | 'WIT';
  isolationCheckHour: number;
}

export interface PsbSettings { installationFee: number; }

const defaults: BillingSettings = {
  billingStartDay: 1,
  billingEndDay: 10,
  billingTimezone: 'WIB',
  isolationCheckHour: 0,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async billing(): Promise<BillingSettings> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: ['billing_start_day', 'billing_end_day', 'billing_timezone', 'isolation_check_hour'] } },
    });
    const data = new Map(rows.map(row => [row.key, row.value]));
    return this.normalize({
      billingStartDay: Number(data.get('billing_start_day') ?? defaults.billingStartDay),
      billingEndDay: Number(data.get('billing_end_day') ?? defaults.billingEndDay),
      billingTimezone: data.get('billing_timezone') ?? defaults.billingTimezone,
      isolationCheckHour: Number(data.get('isolation_check_hour') ?? defaults.isolationCheckHour),
    });
  }

  async psb(): Promise<PsbSettings> {
    const rows = await this.prisma.appSetting.findMany({ where: { key: 'biaya_psb' } });
    const data = new Map(rows.map(row => [row.key, row.value]));
    return { installationFee: Math.max(0, Number(data.get('biaya_psb') || 0)) };
  }

  async updateBilling(dto: BillingSettingsDto) {
    const settings = this.normalize(dto);
    await this.prisma.$transaction([
      this.upsert('billing_start_day', String(settings.billingStartDay)),
      this.upsert('billing_end_day', String(settings.billingEndDay)),
      this.upsert('billing_timezone', settings.billingTimezone),
      this.upsert('isolation_check_hour', String(settings.isolationCheckHour)),
      this.upsert('biaya_psb', String(dto.psbFee)),
    ]);
    return { message: 'Pengaturan penagihan berhasil disimpan.', data: { ...settings, psbFee: dto.psbFee } };
  }

  private upsert(key: string, value: string) {
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  private normalize(input: { billingStartDay: number; billingEndDay: number; billingTimezone: string; isolationCheckHour: number }): BillingSettings {
    const timezone = input.billingTimezone;
    if (!['WIB', 'WITA', 'WIT'].includes(timezone)) throw new BadRequestException('Zona waktu tidak valid.');
    if (input.billingStartDay > input.billingEndDay) throw new BadRequestException('Tanggal mulai pembayaran tidak boleh lebih besar dari tanggal akhir pembayaran.');
    return {
      billingStartDay: input.billingStartDay,
      billingEndDay: input.billingEndDay,
      billingTimezone: timezone as BillingSettings['billingTimezone'],
      isolationCheckHour: input.isolationCheckHour,
    };
  }
}

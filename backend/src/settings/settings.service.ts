import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BillingSettingsDto } from './settings.dto.js';

export interface BillingSettings {
  billingStartDay: number;
  billingEndDay: number;
  billingTimezone: 'WIB' | 'WITA' | 'WIT';
  autoIsolationEnabled: boolean;
  isolationCheckHour: number;
}

const defaults: BillingSettings = {
  billingStartDay: 1,
  billingEndDay: 10,
  billingTimezone: 'WIB',
  autoIsolationEnabled: false,
  isolationCheckHour: 0,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async billing(): Promise<BillingSettings> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: ['billing_start_day', 'billing_end_day', 'billing_timezone', 'auto_isolation_enabled', 'isolation_check_hour'] } },
    });
    const data = new Map(rows.map(row => [row.key, row.value]));
    return this.normalize({
      billingStartDay: Number(data.get('billing_start_day') ?? defaults.billingStartDay),
      billingEndDay: Number(data.get('billing_end_day') ?? defaults.billingEndDay),
      billingTimezone: data.get('billing_timezone') ?? defaults.billingTimezone,
      autoIsolationEnabled: (data.get('auto_isolation_enabled') ?? String(defaults.autoIsolationEnabled)) === 'true',
      isolationCheckHour: Number(data.get('isolation_check_hour') ?? defaults.isolationCheckHour),
    });
  }

  async updateBilling(dto: BillingSettingsDto) {
    const settings = this.normalize(dto);
    await this.prisma.$transaction([
      this.upsert('billing_start_day', String(settings.billingStartDay)),
      this.upsert('billing_end_day', String(settings.billingEndDay)),
      this.upsert('billing_timezone', settings.billingTimezone),
      this.upsert('auto_isolation_enabled', String(settings.autoIsolationEnabled)),
      this.upsert('isolation_check_hour', String(settings.isolationCheckHour)),
    ]);
    return { message: 'Pengaturan penagihan berhasil disimpan.', data: settings };
  }

  private upsert(key: string, value: string) {
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  private normalize(input: { billingStartDay: number; billingEndDay: number; billingTimezone: string; autoIsolationEnabled: boolean; isolationCheckHour: number }): BillingSettings {
    const timezone = input.billingTimezone;
    if (!['WIB', 'WITA', 'WIT'].includes(timezone)) throw new BadRequestException('Zona waktu tidak valid.');
    if (input.billingStartDay > input.billingEndDay) throw new BadRequestException('Tanggal mulai pembayaran tidak boleh lebih besar dari tanggal akhir pembayaran.');
    return {
      billingStartDay: input.billingStartDay,
      billingEndDay: input.billingEndDay,
      billingTimezone: timezone as BillingSettings['billingTimezone'],
      autoIsolationEnabled: input.autoIsolationEnabled,
      isolationCheckHour: input.isolationCheckHour,
    };
  }
}

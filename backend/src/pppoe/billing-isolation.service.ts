import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService, BillingSettings } from '../settings/settings.service.js';
import { RadiusService } from './radius.service.js';
import { PppoeNetworkService } from './pppoe-network.service.js';
import { WhatsappNotifyService } from './whatsapp-notify.service.js';

const timezoneOffset: Record<BillingSettings['billingTimezone'], number> = { WIB: 7, WITA: 8, WIT: 9 };

@Injectable()
export class BillingIsolationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(BillingIsolationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly radius: RadiusService,
    private readonly network: PppoeNetworkService,
    private readonly waNotify: WhatsappNotifyService,
  ) {}

  onModuleInit() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 5 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await this.settings.billing();
      if (!settings.autoIsolationEnabled) return;
      const local = this.localNow(settings.billingTimezone);
      if (local.hour < settings.isolationCheckHour || local.day <= settings.billingEndDay) return;
      await this.isolateOverdue(settings, this.utcDate(local.year, local.month, settings.billingEndDay));
    } catch (error) {
      this.logger.error(`Auto isolir gagal. ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async isolateOverdue(settings: BillingSettings, cutoffDate: Date) {
    const accounts = await this.prisma.pppoeAccount.findMany({
      where: {
        isActive: true,
        package: { isActive: true },
        invoices: { some: { status: 'PENDING', dueDate: { lte: cutoffDate } } },
      },
      include: { package: { include: { ipPool: true } }, invoices: { where: { status: 'PENDING', dueDate: { lte: cutoffDate } }, select: { id: true, amount: true, dueDate: true }, take: 10 } },
      take: 100,
    });
    if (!accounts.length) return;

    for (const account of accounts) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const current = await tx.pppoeAccount.update({
            where: { id: account.id },
            data: { isActive: false, updatedAt: new Date() },
            include: { package: { include: { ipPool: true } } },
          });
          await tx.paymentPromise.updateMany({ where: { pppoeAccountId: account.id, status: { in: ['ACTIVE', 'EXPIRED'] } }, data: { status: 'CANCELLED', disconnectPending: false } });
          await this.radius.sync(tx as Prisma.TransactionClient, current);
        });
        const result = await this.network.disconnect(account.username, account.routerNasId);
        if (result.warnings.length) this.logger.warn(`Auto isolir ${account.username}: ${result.warnings.join(' ')}`);
        else this.logger.log(`Auto isolir ${account.username} karena tagihan melewati tanggal ${settings.billingEndDay} ${settings.billingTimezone}.`);
        await this.waNotify.notifyIsolation({
          customerName: account.customerName,
          customerNumber: account.customerNumber,
          phone: account.phone,
          packageName: account.package.name,
          totalAmount: account.invoices.reduce((total, invoice) => total + Number(invoice.amount), 0),
          dueDate: this.formatDate(account.invoices[0]?.dueDate),
        });
      } catch (error) {
        this.logger.error(`Auto isolir ${account.username} gagal. ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  private localNow(timezone: BillingSettings['billingTimezone']) {
    const shifted = new Date(Date.now() + timezoneOffset[timezone] * 3600000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
    };
  }

  private utcDate(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatDate(date?: Date) {
    if (!date) return undefined;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date);
  }
}

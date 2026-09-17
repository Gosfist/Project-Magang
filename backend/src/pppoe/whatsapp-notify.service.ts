import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);
  private readonly botUrl: string;
  private readonly apiKey: string;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    this.botUrl = this.config.get<string>('BOT_WHATSAPP_URL', 'http://localhost:3002');
    this.apiKey = this.config.get<string>('BOT_API_KEY', 'bot-wa-secret-key-change-me') || 'bot-wa-secret-key-change-me';
  }

  async notifyRegistration(account: {
    customerName: string;
    customerNumber: bigint;
    phone?: string | null;
    username: string;
    password: string;
    package: { name: string };
  }): Promise<void> {
    if (!account.phone || !account.phone.trim()) {
      this.logger.debug('Notifikasi WA dilewati: nomor telepon pelanggan kosong.');
      return;
    }
    try {
      // Check if bot is disabled explicitly
      const enabled = await this.prisma.appSetting.findUnique({ where: { key: 'wa_bot_enabled' } });
      if (enabled && enabled.value === 'false') {
        this.logger.debug('Notifikasi WA dilewati: bot WA dinonaktifkan.');
        return;
      }

      // Get template
      const templateRow = await this.prisma.appSetting.findUnique({ where: { key: 'wa_template_registration' } });
      const template = templateRow?.value || this.defaultTemplate();

      // Replace placeholders
      const customerId = account.customerNumber.toString().padStart(6, '0');
      const message = template
        .replace(/\{nama\}/g, account.customerName)
        .replace(/\{nomor_pelanggan\}/g, customerId)
        .replace(/\{paket\}/g, account.package.name)
        .replace(/\{username\}/g, account.username)
        .replace(/\{password\}/g, account.password);

      this.logger.log(`Mengirim notifikasi WA registrasi ke ${account.phone}...`);

      // Send to bot
      const response = await fetch(`${this.botUrl}/api/wa/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ phone: account.phone, message }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        this.logger.warn(`Notifikasi WA registrasi gagal: HTTP ${response.status} - ${body.message || 'Unknown'}`);
      } else {
        this.logger.log(`Notifikasi WA registrasi berhasil dikirim ke ${account.phone}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notifikasi WA registrasi error: ${message}`);
    }
  }

  async notifyIsolation(account: {
    customerName: string;
    customerNumber: bigint;
    phone?: string | null;
    packageName: string;
    totalAmount?: string | number;
    dueDate?: string;
  }): Promise<void> {
    if (!account.phone) {
      this.logger.debug('Notifikasi WA isolir dilewati: nomor telepon pelanggan kosong.');
      return;
    }
    try {
      const enabled = await this.prisma.appSetting.findUnique({ where: { key: 'wa_bot_enabled' } });
      if (enabled?.value === 'false') {
        this.logger.debug('Notifikasi WA isolir dilewati: bot WA nonaktif.');
        return;
      }

      const templateRow = await this.prisma.appSetting.findUnique({ where: { key: 'wa_template_isolation' } });
      const template = templateRow?.value || this.defaultIsolationTemplate();

      const customerId = account.customerNumber.toString().padStart(6, '0');
      const amountStr = typeof account.totalAmount === 'number'
        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(account.totalAmount)
        : (account.totalAmount || '-');

      const message = template
        .replace(/\{nama\}/g, account.customerName)
        .replace(/\{nomor_pelanggan\}/g, customerId)
        .replace(/\{paket\}/g, account.packageName)
        .replace(/\{total_tagihan\}/g, amountStr)
        .replace(/\{jatuh_tempo\}/g, account.dueDate || '-');

      const response = await fetch(`${this.botUrl}/api/wa/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ phone: account.phone, message }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        this.logger.warn(`Notifikasi WA isolir gagal: ${response.status} - ${body.message || 'Unknown'}`);
      } else {
        this.logger.log(`Notifikasi WA isolir terkirim ke ${account.phone}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notifikasi WA isolir error: ${message}`);
    }
  }

  private defaultTemplate(): string {
    return `Halo {nama}! 👋\n\nSelamat, akun internet Anda telah berhasil didaftarkan di PT Unzanet.\n\n📋 *Detail Akun:*\n• Nomor Pelanggan: {nomor_pelanggan}\n• Paket: {paket}\n• Username PPPoE: {username}\n• Password PPPoE: {password}\n\nTerima kasih telah memilih layanan kami!\n\n— PT Unzanet`;
  }

  private defaultIsolationTemplate(): string {
    return `Halo {nama}! ⚠️\n\nKami informasikan bahwa layanan internet Anda (No. Pelanggan: {nomor_pelanggan}) sementara kami nonaktifkan (isolir) dikarenakan tagihan belum diselesaikan.\n\n📋 *Detail Tagihan:*\n• Paket: {paket}\n• Total Tagihan: {total_tagihan}\n• Batas Pembayaran: {jatuh_tempo}\n\nMohon segera melakukan pembayaran agar layanan internet Anda dapat aktif kembali secara otomatis.\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.\n\n— PT Unzanet`;
  }
}

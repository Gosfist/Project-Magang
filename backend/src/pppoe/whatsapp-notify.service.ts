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

  async notifySalesRegistration(account: { customerName: string; customerNumber: bigint; phone: string; address: string; packageName: string }) {
    const template = await this.template('sales', `Halo Bapak/Ibu {nama},\n\nProses registrasi pelanggan baru telah berhasil. Mohon bersabar, teknisi kami akan melakukan kunjungan.\n\nNo. Pelanggan: {nomor_pelanggan}\nNama: {nama}\nNomor WA: {nomor_wa}\nAlamat: {alamat}\nLayanan: {layanan}\n\n— PT Unzanet`);
    return this.send(account.phone, template.replace(/\{nama\}/g, account.customerName).replace(/\{nomor_pelanggan\}/g, account.customerNumber.toString().padStart(6, '0')).replace(/\{nomor_wa\}/g, account.phone).replace(/\{alamat\}/g, account.address).replace(/\{layanan\}/g, account.packageName));
  }

  async notifyPsbCompleted(account: { customerName: string; customerNumber: bigint; phone: string; packageName: string; installationFee: number; billingStartDay: number; billingEndDay: number }) {
    const template = await this.template('psb', `Halo Bapak/Ibu {nama},\n\nInternet Anda telah aktif.\n\nNo. Pelanggan: {nomor_pelanggan}\nLayanan: {layanan}\nBiaya PSB: {biaya_psb}\nPembayaran berikutnya tanggal {tanggal_mulai}-{tanggal_akhir} setiap bulan. Jika melewati jatuh tempo, layanan dapat diisolir.\n\n— PT Unzanet`);
    const fee = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(account.installationFee);
    return this.send(account.phone, template.replace(/\{nama\}/g, account.customerName).replace(/\{nomor_pelanggan\}/g, account.customerNumber.toString().padStart(6, '0')).replace(/\{layanan\}/g, account.packageName).replace(/\{biaya_psb\}/g, fee).replace(/\{tanggal_mulai\}/g, String(account.billingStartDay)).replace(/\{tanggal_akhir\}/g, String(account.billingEndDay)));
  }

  private async template(name: string, fallback: string) {
    const row = await this.prisma.appSetting.findUnique({ where: { key: `wa_template_${name}` } });
    return row?.value || fallback;
  }

  private async send(phone: string, message: string): Promise<boolean> {
    if (!phone?.trim()) return false;
    try {
      const enabled = await this.prisma.appSetting.findUnique({ where: { key: 'wa_bot_enabled' } });
      if (enabled?.value === 'false') return false;
      const response = await fetch(`${this.botUrl}/api/wa/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey }, body: JSON.stringify({ phone, message }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        this.logger.warn(`Notifikasi WA gagal: HTTP ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Notifikasi WA gagal: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
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

  async notifyPaymentReminder(account: {
    customerName: string;
    customerNumber: bigint;
    phone?: string | null;
    packageName: string;
    totalAmount: number;
    dueDate: string;
  }): Promise<void> {
    if (!account.phone?.trim()) return;
    const template = await this.template('payment_reminder', 'Halo Bapak/Ibu {nama},\n\nTagihan layanan internet Anda sudah memasuki periode pembayaran.\n\nNo. Pelanggan: {nomor_pelanggan}\nPaket: {paket}\nTotal Tagihan: {total_tagihan}\nBatas Pembayaran: {jatuh_tempo}\n\nSilakan lakukan pembayaran sebelum jatuh tempo agar layanan tetap aktif.\n\n— PT Unzanet');
    const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(account.totalAmount);
    const sent = await this.send(account.phone, template
      .replace(/\{nama\}/g, account.customerName)
      .replace(/\{nomor_pelanggan\}/g, account.customerNumber.toString().padStart(6, '0'))
      .replace(/\{paket\}/g, account.packageName)
      .replace(/\{total_tagihan\}/g, amount)
      .replace(/\{jatuh_tempo\}/g, account.dueDate));
    if (!sent) throw new Error('Bot WhatsApp tidak menerima pengingat tagihan.');
  }

  private defaultTemplate(): string {
    return `Halo {nama}! 👋\n\nSelamat, akun internet Anda telah berhasil didaftarkan di PT Unzanet.\n\n📋 *Detail Akun:*\n• Nomor Pelanggan: {nomor_pelanggan}\n• Paket: {paket}\n• Username PPPoE: {username}\n• Password PPPoE: {password}\n\nTerima kasih telah memilih layanan kami!\n\n— PT Unzanet`;
  }

  private defaultIsolationTemplate(): string {
    return `Halo {nama}! ⚠️\n\nKami informasikan bahwa layanan internet Anda (No. Pelanggan: {nomor_pelanggan}) sementara kami nonaktifkan (isolir) dikarenakan tagihan belum diselesaikan.\n\n📋 *Detail Tagihan:*\n• Paket: {paket}\n• Total Tagihan: {total_tagihan}\n• Batas Pembayaran: {jatuh_tempo}\n\nMohon segera melakukan pembayaran agar layanan internet Anda dapat aktif kembali secara otomatis.\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.\n\n— PT Unzanet`;
  }

  async notifyDepositToCollector(account: {
    customerName: string;
    customerNumber: bigint;
    phone: string;
    amount: number;
    depositDate: string;
    collectorName: string;
    areaName: string;
  }): Promise<void> {
    try {
      const enabled = await this.prisma.appSetting.findUnique({ where: { key: 'wa_bot_enabled' } });
      if (enabled?.value === 'false') return;

      const templateRow = await this.prisma.appSetting.findUnique({ where: { key: 'wa_template_deposit_collector' } });
      const template = templateRow?.value || this.defaultDepositCollectorTemplate();

      const customerId = account.customerNumber.toString().padStart(6, '0');
      const amountStr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(account.amount);
      const dateStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(account.depositDate));

      const message = template
        .replace(/\{nama\}/g, account.customerName)
        .replace(/\{nomor_pelanggan\}/g, customerId)
        .replace(/\{jumlah\}/g, amountStr)
        .replace(/\{tanggal_setor\}/g, dateStr)
        .replace(/\{nama_kolektor\}/g, account.collectorName)
        .replace(/\{nama_pengepul\}/g, account.collectorName)
        .replace(/\{area\}/g, account.areaName);

      this.logger.log(`Mengirim notifikasi WA setoran ke kolektor ke ${account.phone}...`);

      const response = await fetch(`${this.botUrl}/api/wa/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
        body: JSON.stringify({ phone: account.phone, message }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        this.logger.warn(`Notifikasi WA setoran kolektor gagal: ${response.status} - ${body.message || 'Unknown'}`);
      } else {
        this.logger.log(`Notifikasi WA setoran kolektor terkirim ke ${account.phone}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notifikasi WA setoran kolektor error: ${message}`);
    }
  }

  async notifyDepositAccepted(account: {
    customerName: string;
    customerNumber: bigint;
    phone: string;
    amount: number;
    acceptedDate: string;
    billingMonth: string;
  }): Promise<void> {
    try {
      const enabled = await this.prisma.appSetting.findUnique({ where: { key: 'wa_bot_enabled' } });
      if (enabled?.value === 'false') return;

      const templateRow = await this.prisma.appSetting.findUnique({ where: { key: 'wa_template_deposit_accepted' } });
      const template = templateRow?.value || this.defaultDepositAcceptedTemplate();

      const customerId = account.customerNumber.toString().padStart(6, '0');
      const amountStr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(account.amount);
      const dateStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(account.acceptedDate));

      const message = template
        .replace(/\{nama\}/g, account.customerName)
        .replace(/\{nomor_pelanggan\}/g, customerId)
        .replace(/\{jumlah\}/g, amountStr)
        .replace(/\{bulan_tagihan\}/g, account.billingMonth)
        .replace(/\{tanggal_diterima\}/g, dateStr);

      this.logger.log(`Mengirim notifikasi WA setoran diterima ke ${account.phone}...`);

      const response = await fetch(`${this.botUrl}/api/wa/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
        body: JSON.stringify({ phone: account.phone, message }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        this.logger.warn(`Notifikasi WA setoran diterima gagal: ${response.status} - ${body.message || 'Unknown'}`);
      } else {
        this.logger.log(`Notifikasi WA setoran diterima terkirim ke ${account.phone}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notifikasi WA setoran diterima error: ${message}`);
    }
  }

  private defaultDepositCollectorTemplate(): string {
    return `Halo {nama}! 📝\n\nKami informasikan bahwa tagihan Anda telah disetor ke kolektor kami.\n\n📋 *Detail Setoran:*\n• Nomor Pelanggan: {nomor_pelanggan}\n• Jumlah: {jumlah}\n• Tanggal Setor: {tanggal_setor}\n• Kolektor: {nama_kolektor}\n• Area: {area}\n\nSetoran Anda sedang diverifikasi oleh tim kami. Anda akan menerima notifikasi setelah pembayaran dikonfirmasi.\n\n— PT Unzanet`;
  }

  private defaultDepositAcceptedTemplate(): string {
    return `Halo {nama}! ✅\n\nPembayaran tagihan Anda telah berhasil diterima dan dikonfirmasi oleh perusahaan.\n\n📋 *Detail Pembayaran:*\n• Nomor Pelanggan: {nomor_pelanggan}\n• Jumlah: {jumlah}\n• Bulan Tagihan: {bulan_tagihan}\n• Diterima Pada: {tanggal_diterima}\n\nTerima kasih atas pembayaran Anda! Layanan internet Anda tetap aktif.\n\n— PT Unzanet`;
  }
}

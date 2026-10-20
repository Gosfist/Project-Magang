import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { serialize } from '../../common/serialize.js';
import { vpnCaCertificate } from '../shared/radius-setup-script.js';
import { randomBytes } from 'node:crypto';

@Injectable()
export class VpnService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly secrets: SecretService) {}

  private server() {
    const host = this.config.get<string>('VPN_SSTP_HOST') || '';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(host)) throw new ServiceUnavailableException('Server VPN belum disiapkan. Jalankan npm run setupvpnserver pada VPS.');
    return { host, port: 4443, gateway: '10.88.0.1' };
  }

  async list() {
    const server = this.server();
    const clients = await this.prisma.vpnClient.findMany({ where: { vpnType: 'sstp' }, include: { routers: { select: { id: true, name: true } } }, orderBy: { id: 'desc' } });
    return serialize({ server, data: clients.map(c => ({ id: c.id, name: c.name, username: c.username, vpnIp: c.vpnIp, isActive: c.isActive, provisionedAt: c.provisionedAt, routers: c.routers ? [c.routers] : [] })) });
  }

  async credentials(id: string) {
    const client = await this.find(id);
    return { password: this.secrets.decrypt(client.passwordEncrypted!) };
  }

  async create(name: string, username: string, password?: string) {
    this.server();
    const plain = password || randomBytes(18).toString('hex');
    // Restrict the alphabet to make the root worker's chap-secrets file unambiguous.
    if (!name?.trim() || name.length > 100 || !/^[a-zA-Z0-9_-]{1,64}$/.test(username) || !/^[a-zA-Z0-9_!@%+=.,:-]{12,128}$/.test(plain)) throw new BadRequestException('Isi nama, username (huruf/angka/_/-), dan password 12–128 karakter tanpa spasi, kutip, atau garis miring.');
    try {
      const client = await this.prisma.$transaction(async tx => {
        const clients = await tx.vpnClient.findMany({ where: { vpnType: 'sstp' }, select: { vpnIp: true } });
        const used = new Set(clients.map(c => c.vpnIp));
        let ip = '';
        for (let n = 2; n <= 254; n++) if (!used.has(`10.88.0.${n}`)) { ip = `10.88.0.${n}`; break; }
        if (!ip) throw new BadRequestException('Pool IP VPN sudah penuh.');
        return tx.vpnClient.create({ data: { name: name.trim(), username, passwordEncrypted: this.secrets.encrypt(plain), vpnIp: ip, vpnType: 'sstp', allowedIps: '10.88.0.1/32' } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return serialize({ message: 'Akun disimpan. Tunggu status Siap sebelum memasang script MikroTik (sekitar 15 detik).', id: client.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new ConflictException('Username/IP sudah digunakan atau sedang dialokasikan. Muat ulang lalu coba lagi.');
      throw error;
    }
  }

  private async find(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n) throw new BadRequestException('ID klien VPN tidak valid.');
    const client = await this.prisma.vpnClient.findUnique({ where: { id: BigInt(id) } });
    if (!client || client.vpnType !== 'sstp' || !client.username || !client.passwordEncrypted) throw new BadRequestException('Klien VPN tidak ditemukan.');
    return client;
  }

  async forRouter(id: string, routerId?: number) {
    const server = this.server();
    const client = await this.find(id);
    if (!client.isActive || !client.provisionedAt) throw new BadRequestException('Klien VPN belum siap. Muat ulang Klien VPN dan tunggu penerapan server.');
    const other = await this.prisma.nas.findFirst({ where: { vpnClientId: client.id, ...(routerId ? { id: { not: routerId } } : {}) }, select: { id: true } });
    if (other) throw new ConflictException('Klien VPN sudah dipakai router lain. Buat satu akun VPN untuk setiap router.');
    const ca = vpnCaCertificate(await readFile('/etc/unzanet-public/sstp-ca.crt', 'utf8'));
    if (!ca) throw new ServiceUnavailableException('CA server VPN belum tersedia.');
    return { id: client.id, ip: client.vpnIp, host: server.host, username: client.username!, password: this.secrets.decrypt(client.passwordEncrypted!), ca, radiusIp: server.gateway };
  }
}

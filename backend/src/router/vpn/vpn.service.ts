import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { serialize } from '../../common/serialize.js';
import { randomBytes } from 'node:crypto';

@Injectable()
export class VpnService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly secrets: SecretService) {}

  private server() {
    const host = this.config.get<string>('VPN_SSTP_HOST') || '';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(host)) throw new ServiceUnavailableException('Server VPN belum disiapkan. Jalankan npm run install pada VPS.');
    return { host, port: 4443, gateway: '10.88.0.1' };
  }

  async list(includeCredentials = false) {
    const server = this.server();
    const clients = await this.prisma.vpnClient.findMany({ where: { vpnType: 'sstp' }, include: { routers: { select: { id: true, name: true } } }, orderBy: { id: 'desc' } });
    return serialize({ server, data: clients.map(c => ({ id: c.id, name: c.name, username: c.username, vpnIp: c.vpnIp, isActive: c.isActive, provisionedAt: c.provisionedAt, routers: c.routers ? [c.routers] : [], ...(includeCredentials ? { password: this.secrets.decrypt(c.passwordEncrypted!) } : {}) })) });
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
      return serialize({ message: 'Akun VPN dibuat. Penerapan ke server sekitar 15 detik.', id: client.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new ConflictException('Username/IP sudah digunakan atau sedang dialokasikan. Muat ulang lalu coba lagi.');
      throw error;
    }
  }

  async update(id: string, name: string, username: string, password?: string) {
    if (!name?.trim() || name.length > 100 || !/^[a-zA-Z0-9_-]{1,64}$/.test(username)
        || (password !== undefined && !/^[a-zA-Z0-9_!@%+=.,:-]{12,128}$/.test(password))) {
      throw new BadRequestException('Isi nama, username (huruf/angka/_/-), dan password 12–128 karakter tanpa spasi, kutip, atau garis miring.');
    }
    try {
      await this.prisma.$transaction(async tx => {
        const client = await this.find(id, tx);
        const passwordChanged = password !== undefined && password !== this.secrets.decrypt(client.passwordEncrypted!);
        const credentialsChanged = username !== client.username || passwordChanged;
        await tx.vpnClient.update({ where: { id: client.id }, data: {
          name: name.trim(), username,
          ...(passwordChanged ? { passwordEncrypted: this.secrets.encrypt(password!) } : {}),
          ...(credentialsChanged ? { provisionedAt: null } : {}),
        } });
        if (username !== client.username) {
          await tx.nas.updateMany({ where: { vpnClientId: client.id }, data: { vpnUsername: username } });
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { message: 'Perubahan disimpan. Penerapan server sekitar 15 detik. Jika username/password berubah, ambil ulang script Router / NAS dan terapkan pada MikroTik.' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new ConflictException('Username sudah digunakan atau akun sedang diubah. Muat ulang lalu coba lagi.');
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.$transaction(async tx => {
        const client = await this.find(id, tx);
        const router = await tx.nas.findFirst({ where: { vpnClientId: client.id }, select: { id: true } });
        if (router) throw new ConflictException('Akun VPN masih dipakai Router / NAS. Lepaskan atau ganti klien VPN pada NAS tersebut sebelum menghapus akun.');
        await tx.vpnClient.delete({ where: { id: client.id } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { message: 'Akun VPN dihapus. Penerapan ke server sekitar 15 detik.' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2003', 'P2034'].includes(error.code)) throw new ConflictException('Akun sedang dipakai atau diubah. Muat ulang lalu coba lagi.');
      throw error;
    }
  }

  private async find(id: string, store: Pick<Prisma.TransactionClient, 'vpnClient'> = this.prisma) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n) throw new BadRequestException('ID klien VPN tidak valid.');
    const client = await store.vpnClient.findUnique({ where: { id: BigInt(id) } });
    if (!client || client.vpnType !== 'sstp' || !client.username || !client.passwordEncrypted) throw new BadRequestException('Klien VPN tidak ditemukan.');
    return client;
  }

  async forRouter(id: string, routerId?: number) {
    const server = this.server();
    const client = await this.find(id);
    if (!client.isActive || !client.provisionedAt) throw new BadRequestException('Klien VPN belum siap. Muat ulang Klien VPN dan tunggu penerapan server.');
    const other = await this.prisma.nas.findFirst({ where: { vpnClientId: client.id, ...(routerId ? { id: { not: routerId } } : {}) }, select: { id: true } });
    if (other) throw new ConflictException('Klien VPN sudah dipakai router lain. Buat satu akun VPN untuk setiap router.');
    return { id: client.id, ip: client.vpnIp, host: server.host, username: client.username!, password: this.secrets.decrypt(client.passwordEncrypted!), radiusIp: server.gateway };
  }
}

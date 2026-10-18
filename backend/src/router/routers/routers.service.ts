import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Nas } from '@prisma/client';
import crypto from 'node:crypto';
import { isIPv4 } from 'node:net';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveRouterDto } from './routers.dto.js';
import { radiusSetupScript } from '../shared/radius-setup-script.js';

@Injectable()
export class RoutersService {
  constructor(private readonly prisma: PrismaService) {}

  private publicRouter(router: Nas & { _count?: { accounts: number } }) {
    // Explicit allowlist prevents old credentials and RADIUS secrets leaking in list/save responses.
    return {
      id: router.id, name: router.name, nasname: router.nasname, shortname: router.shortname,
      type: router.type, ipAddress: router.ipAddress, ports: router.ports, coaPort: router.coaPort,
      radiusServerIp: router.radiusServerIp, vpnHost: router.vpnHost, vpnUsername: router.vpnUsername,
      description: router.description, isActive: router.isActive,
      createdAt: router.createdAt, updatedAt: router.updatedAt,
      ...(router._count ? { accountsCount: router._count.accounts } : {}),
    };
  }

  async routers(search = '', page = 1) {
    const where: Prisma.NasWhereInput = search ? { OR: [
      { name: { contains: search } }, { nasname: { contains: search } },
      { shortname: { contains: search } }, { ipAddress: { contains: search } },
    ] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.nas.findMany({ where, include: { _count: { select: { accounts: true } } }, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10 }),
      this.prisma.nas.count({ where }),
    ]);
    return serialize({ data: items.map(item => this.publicRouter(item)), meta: pageMeta(page, 10, total) });
  }

  async routerOptions() {
    const data = await this.prisma.nas.findMany({
      where: { isActive: true }, select: { id: true, name: true, nasname: true, shortname: true, description: true, ipAddress: true }, orderBy: { id: 'asc' },
    });
    return serialize({ data: data.map(d => ({ ...d, displayName: d.name || d.shortname || d.nasname })) });
  }

  async createRouter(dto: SaveRouterDto) {
    const data = this.routerData(dto);
    await this.assertUniqueNas(data.nasname);
    try {
      const item = await this.prisma.nas.create({ data: { ...data, createdAt: new Date() } });
      return serialize({ message: 'NAS ditambahkan. Salin script ke Terminal MikroTik. Konfigurasi NAS diterapkan FreeRADIUS dalam sekitar 60 detik.', router: this.publicRouter(item), setup: this.setup(item, dto.vpnPassword) });
    } catch (error) { this.unique(error); }
  }

  async updateRouter(id: string, dto: SaveRouterDto) {
    const current = await this.findRouter(id);
    const data = this.routerData(dto, current);
    await this.assertUniqueNas(data.nasname, current.id);
    try {
      const item = await this.prisma.nas.update({ where: { id: current.id }, data });
      return serialize({ message: 'NAS diperbarui. Terapkan script jika konfigurasi berubah. FreeRADIUS menerapkan perubahan dalam sekitar 60 detik.', router: this.publicRouter(item), setup: this.setup(item, dto.vpnPassword) });
    } catch (error) { this.unique(error); }
  }

  async removeRouter(id: string) {
    const current = await this.findRouter(id);
    const accountsCount = await this.prisma.pppoeAccount.count({ where: { routerNasId: current.id } });
    if (accountsCount > 0) throw new BadRequestException(`Router masih digunakan oleh ${accountsCount} pelanggan PPPoE dan tidak dapat dihapus.`);
    await this.prisma.nas.delete({ where: { id: current.id } });
    return { message: 'NAS dihapus. FreeRADIUS menerapkan perubahan dalam sekitar 60 detik. Konfigurasi pada perangkat tidak dihapus otomatis.' };
  }

  async getRouterScript(id: string) { return serialize(this.setup(await this.findRouter(id))); }

  private setup(router: Nas, vpnPassword?: string) {
    const radiusServerIp = this.serverIp(router.radiusServerIp);
    return {
      routerName: router.name, radiusServerIp, nasSrcAddress: router.nasname,
      authPort: router.ports || 1812, coaPort: router.coaPort || 3799,
      scriptRos7: radiusSetupScript(router, radiusServerIp, router.nasname, true, vpnPassword),
      scriptRos6: radiusSetupScript(router, radiusServerIp, router.nasname, false, vpnPassword),
    };
  }

  private routerData(dto: SaveRouterDto, current?: Nas) {
    const name = dto.name?.trim();
    const nasname = dto.nasname?.trim();
    const ipAddress = dto.ipAddress?.trim() || nasname;
    if (!name || !nasname || !isIPv4(nasname) || !ipAddress || !isIPv4(ipAddress)) throw new BadRequestException('Nama router dan alamat IPv4 NAS/Disconnect yang valid wajib diisi.');
    const radiusServerIp = this.serverIp(dto.radiusServerIp?.trim() || current?.radiusServerIp);
    const vpnHost = dto.vpnHost === undefined ? current?.vpnHost || null : dto.vpnHost.trim() || null;
    const vpnUsername = dto.vpnUsername === undefined ? current?.vpnUsername || null : dto.vpnUsername.trim() || null;
    if (Boolean(vpnHost) !== Boolean(vpnUsername)) throw new BadRequestException('Host dan username VPN harus diisi bersama.');
    if (dto.vpnPassword && (!vpnHost || !vpnUsername)) throw new BadRequestException('Host dan username VPN wajib diisi untuk membuat script tunnel.');
    if (vpnHost && (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(vpnHost) || vpnHost.length > 253)) throw new BadRequestException('Host VPN tidak valid.');
    const ports = dto.ports ?? current?.ports ?? 1812;
    const coaPort = dto.coaPort ?? current?.coaPort ?? 3799;
    for (const port of [ports, coaPort]) if (!Number.isInteger(port) || port < 1 || port > 65535) throw new BadRequestException('Port harus antara 1 dan 65535.');
    const secret = dto.secret || current?.secret || crypto.randomBytes(24).toString('hex');
    if (secret.length > 60 || !secret.trim()) throw new BadRequestException('Shared secret harus berisi 1 sampai 60 karakter.');
    return {
      name, nasname, ipAddress, radiusServerIp, vpnHost, vpnUsername, ports, coaPort, secret,
      shortname: dto.shortname?.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32),
      type: dto.type?.trim() || current?.type || 'mikrotik', description: dto.description?.trim() || null,
      isActive: dto.isActive ?? current?.isActive ?? true, updatedAt: new Date(),
    };
  }

  private serverIp(value?: string | null): string {
    const ip = value || process.env.RADIUS_SERVER_IP?.trim();
    if (!ip || !isIPv4(ip) || ip === '0.0.0.0' || ip.startsWith('127.')) throw new BadRequestException('Isi IP server RADIUS yang dapat dijangkau NAS, atau atur RADIUS_SERVER_IP.');
    return ip;
  }

  private async assertUniqueNas(nasname: string, exceptId?: number) {
    const duplicate = await this.prisma.nas.findFirst({ where: { nasname, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (duplicate) throw new ConflictException('IP sumber NAS sudah terdaftar. Gunakan IP VPN unik untuk setiap router.');
  }

  private async findRouter(id: string) {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new BadRequestException('ID NAS tidak valid.');
    const item = await this.prisma.nas.findUnique({ where: { id: Number(id) } });
    if (!item) throw new NotFoundException('Router NAS tidak ditemukan.');
    return item;
  }

  private unique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Router dengan parameter tersebut sudah terdaftar.');
    throw error;
  }
}

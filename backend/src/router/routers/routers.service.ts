import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveRouterDto } from './routers.dto.js';

import crypto from 'crypto';
import { MikrotikService } from '../shared/mikrotik.service.js';
import os from 'os';
import { radiusSetupScript } from '../shared/radius-setup-script.js';

@Injectable()
export class RoutersService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) { }

  // ==========================================
  // 1. Pengelolaan Router / NAS.
  // ==========================================

  async routers(search = '', page = 1) {
    const where: Prisma.NasWhereInput = search
      ? {
          OR: [
            { name: { contains: search } },
            { nasname: { contains: search } },
            { shortname: { contains: search } },
            { ipAddress: { contains: search } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.nas.findMany({
        where,
        include: {
          vpnClient: { select: { id: true, name: true, vpnIp: true } },
          _count: { select: { accounts: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.prisma.nas.count({ where }),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      accountsCount: item._count.accounts,
    }));

    return serialize({ data: formatted, meta: pageMeta(page, 10, total) });
  }

  async routerOptions() {
    const data = await this.prisma.nas.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        shortname: true,
        description: true,
        ipAddress: true,
      },
      orderBy: { id: 'asc' },
    });
    return serialize({
      data: data.map((d) => ({
        ...d,
        displayName: d.name || d.shortname || d.nasname,
      })),
    });
  }

  async createRouter(dto: SaveRouterDto) {
    const vpnAddress = await this.vpnAddress(dto.vpnClientId);
    const shortname =
      dto.shortname?.trim() ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 32);
    const finalSecret = dto.secret?.trim() || crypto.randomBytes(8).toString('hex');
    const port = dto.port || 8728;
    const ports = dto.ports || 1812;
    const now = new Date();

    try {
      const item = await this.prisma.nas.create({
        data: {
          name: dto.name.trim(),
          nasname: vpnAddress || dto.nasname.trim(),
          shortname,
          type: dto.type?.trim() || 'mikrotik',
          authMode: 'radius', // Router ini hanya memakai autentikasi RADIUS.
          ipAddress: vpnAddress || dto.ipAddress?.trim() || dto.nasname.trim(),
          username: dto.username?.trim() || null,
          password: dto.password || null,
          port,
          ports,
          secret: finalSecret,
          vpnClientId: dto.vpnClientId ? BigInt(dto.vpnClientId) : null,
          description: dto.description?.trim() || 'MikroTik Router NAS',
          isActive: dto.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        },
        include: { vpnClient: true },
      });
      return serialize({ message: 'Router NAS berhasil ditambahkan.', router: item });
    } catch (error) {
      this.unique(error, 'Router dengan parameter tersebut sudah terdaftar.');
    }
  }

  async updateRouter(id: string, dto: SaveRouterDto) {
    const current = await this.findRouter(id);
    const vpnAddress = await this.vpnAddress(dto.vpnClientId);
    const shortname =
      dto.shortname?.trim() ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 32);

    try {
      const item = await this.prisma.nas.update({
        where: { id: current.id },
        data: {
          name: dto.name.trim(),
          nasname: vpnAddress || dto.nasname.trim(),
          shortname,
          type: dto.type?.trim() || current.type,
          authMode: 'radius', // Router ini selalu memakai autentikasi RADIUS.
          ipAddress: vpnAddress || dto.ipAddress?.trim() || dto.nasname.trim(),
          username: dto.username?.trim() || null,
          password: dto.password !== undefined ? dto.password : current.password,
          port: dto.port ?? current.port,
          ports: dto.ports ?? current.ports,
          secret: dto.secret?.trim() || current.secret,
          vpnClientId: dto.vpnClientId ? BigInt(dto.vpnClientId) : null,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? current.isActive,
          updatedAt: new Date(),
        },
        include: { vpnClient: true },
      });
      return serialize({ message: 'Router NAS berhasil diperbarui.', router: item });
    } catch (error) {
      this.unique(error, 'Router dengan parameter tersebut sudah terdaftar.');
    }
  }

  async removeRouter(id: string) {
    const current = await this.findRouter(id);
    const accountsCount = await this.prisma.pppoeAccount.count({
      where: { routerNasId: current.id },
    });
    if (accountsCount > 0) {
      throw new BadRequestException(
        `Router masih digunakan oleh ${accountsCount} pelanggan PPPoE dan tidak dapat dihapus.`,
      );
    }
    await this.prisma.nas.delete({ where: { id: current.id } });
    return { message: 'Router NAS berhasil dihapus.' };
  }

  async testConnection(id: string) {
    const router = await this.findRouter(id);
    const host = router.ipAddress || router.nasname;
    const port = router.port || 8728;
    const started = Date.now();
    try {
      const identity = await this.mikrotik.withRouter(router, async (write) => {
        const rows = await write('/system/identity/print');
        return rows[0]?.name || router.name || host;
      });
      return { success: true, message: `Berhasil masuk ke API MikroTik. Router: ${identity}.`, identity, latencyMs: Date.now() - started, host, port };
    } catch (error) {
      return { success: false, message: this.mikrotik.errorMessage(error), host, port };
    }
  }

  async getRouterScript(id: string) {
    const router = await this.prisma.nas.findUnique({
      where: { id: Number(id) },
      include: {
        vpnClient: true,
      },
    });
    if (!router) throw new NotFoundException('Router tidak ditemukan.');

    let radiusServerIp = this.detectServerIp();
    if (router.vpnClient) {
      const client = router.vpnClient;
      if (!client.networkId || !client.vpnIp || !client.nodeId || !client.isActive || client.isRadiusServer || client.deviceType !== 'mikrotik') {
        throw new BadRequestException('Klien ZeroTier MikroTik belum lengkap/aktif. Perbarui data Node ID dan IP di Klien VPN.');
      }
      const server = await this.prisma.vpnClient.findFirst({
        where: { networkId: client.networkId, isRadiusServer: true, isActive: true },
        select: { vpnIp: true, nodeId: true },
      });
      if (!server?.vpnIp || !server.nodeId) throw new BadRequestException('Catat IP ZeroTier dan Node ID Ubuntu RADIUS pada Klien VPN terlebih dahulu.');
      if (router.nasname !== client.vpnIp || router.ipAddress !== client.vpnIp) {
        throw new BadRequestException('Simpan ulang Router / NAS dengan klien ZeroTier terpilih agar IP API dan IP NAS sesuai.');
      }
      radiusServerIp = server.vpnIp;
    }
    const nasSrcAddress = router.vpnClient?.vpnIp || router.nasname;
    const secret = router.secret || 'secret';
    const authPort = router.ports || 1812;
    const scriptRos7 = radiusSetupScript(router, radiusServerIp, nasSrcAddress, true);
    const scriptRos6 = radiusSetupScript(router, radiusServerIp, nasSrcAddress, false);

    return serialize({
      routerName: router.name,
      radiusServerIp,
      nasSrcAddress,
      secret,
      authPort,
      scriptRos7,
      scriptRos6,
    });
  }

  private async vpnAddress(id?: string): Promise<string | null> {
    if (!id) return null;
    if (!/^[1-9][0-9]*$/.test(id)) throw new BadRequestException('ID klien VPN tidak valid.');
    const client = await this.prisma.vpnClient.findUnique({ where: { id: BigInt(id) } });
    if (!client?.networkId || !client.vpnIp || !client.nodeId || !client.isActive || client.isRadiusServer || client.deviceType !== 'mikrotik') {
      throw new BadRequestException('Pilih klien ZeroTier MikroTik aktif dengan Node ID dan IP yang sudah dicatat.');
    }
    return client.vpnIp;
  }

  private detectServerIp(): string {
    if (process.env.RADIUS_SERVER_IP) return process.env.RADIUS_SERVER_IP;
    if (process.env.VPS_IP) return process.env.VPS_IP;
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private async findRouter(id: string) {
    const item = await this.prisma.nas.findUnique({ where: { id: Number(id) } });
    if (!item) throw new NotFoundException('Router NAS tidak ditemukan.');
    return item;
  }

  private unique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}

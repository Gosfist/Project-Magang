import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveRouterDto } from './routers.dto.js';

import crypto from 'crypto';
import { MikrotikService } from '../shared/mikrotik.service.js';
import os from 'os';

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
          nasname: dto.nasname.trim(),
          shortname,
          type: dto.type?.trim() || 'mikrotik',
          authMode: 'radius', // Router ini hanya memakai autentikasi RADIUS.
          ipAddress: dto.ipAddress?.trim() || dto.nasname.trim(),
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
          nasname: dto.nasname.trim(),
          shortname,
          type: dto.type?.trim() || current.type,
          authMode: 'radius', // Router ini selalu memakai autentikasi RADIUS.
          ipAddress: dto.ipAddress?.trim() || dto.nasname.trim(),
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
        vpnClient: {
          include: { vpnServer: true },
        },
      },
    });
    if (!router) throw new NotFoundException('Router tidak ditemukan.');

    const radiusServerIp = this.detectServerIp();
    const nasSrcAddress = router.vpnClient?.vpnIp || router.nasname;
    const secret = router.secret || 'secret';
    const authPort = router.ports || 1812;
    const comment = `UNZANET RADIUS - ${router.name || router.nasname}`;

    const srcParam = nasSrcAddress ? ` src-address=${nasSrcAddress}` : '';

    const scriptRos7 = `
# ============================================
# Skrip Pengaturan RADIUS UNZANET (RouterOS 7.x)
# Router: ${router.name || router.nasname}
# IP NAS (Sumber): ${nasSrcAddress}
# Server RADIUS: ${radiusServerIp}
# Mode Autentikasi: HANYA RADIUS
# ============================================

# 1. Hapus konfigurasi RADIUS lama (jika ada)
/radius remove [find where comment~"UNZANET" || comment~"Auto Setup"]

# 2. Tambahkan Server RADIUS (Autentikasi & Akuntansi)
/radius add address=${radiusServerIp} secret="${secret}"${srcParam} service=ppp,hotspot,login authentication-port=${authPort} accounting-port=1813 timeout=3s require-message-auth=no comment="${comment}"

# 3. Aktifkan RADIUS untuk PPP dan pembaruan sementara setiap 5 menit
/ppp aaa set use-radius=yes accounting=yes interim-update=5m

# 4. Aktifkan RADIUS masuk (CoA / pemutusan sesi pada port 3799)
/radius incoming set accept=yes port=3799

# 5. Aktifkan RADIUS untuk profil server Hotspot (opsional jika ada Hotspot)
/ip hotspot profile set [find] use-radius=yes

# 6. Izinkan lalu lintas RADIUS dan CoA pada firewall
/ip firewall filter add chain=input protocol=udp src-address=${radiusServerIp} dst-port=3799 action=accept comment="UNZANET-RADIUS CoA Disconnect"
/ip firewall filter add chain=input protocol=udp src-address=${radiusServerIp} dst-port=${authPort},1813 action=accept comment="UNZANET-RADIUS Auth Acct"
`.trim();

    const scriptRos6 = `
# ============================================
# Skrip Pengaturan RADIUS UNZANET (RouterOS 6.x)
# Router: ${router.name || router.nasname}
# IP NAS (Sumber): ${nasSrcAddress}
# Server RADIUS: ${radiusServerIp}
# Mode Autentikasi: HANYA RADIUS
# ============================================

# 1. Hapus konfigurasi RADIUS lama (jika ada)
/radius remove [find where comment~"UNZANET" || comment~"Auto Setup"]

# 2. Tambahkan Server RADIUS (Autentikasi & Akuntansi)
/radius add address=${radiusServerIp} secret="${secret}"${srcParam} service=ppp,hotspot,login authentication-port=${authPort} accounting-port=1813 timeout=3s comment="${comment}"

# 3. Aktifkan RADIUS untuk PPP dan pembaruan sementara setiap 5 menit
/ppp aaa set use-radius=yes accounting=yes interim-update=5m

# 4. Aktifkan RADIUS masuk (CoA / pemutusan sesi pada port 3799)
/radius incoming set accept=yes port=3799

# 5. Aktifkan RADIUS untuk profil server Hotspot
/ip hotspot profile set [find] use-radius=yes

# 6. Izinkan lalu lintas RADIUS dan CoA pada firewall
/ip firewall filter add chain=input protocol=udp src-address=${radiusServerIp} dst-port=3799 action=accept comment="UNZANET-RADIUS CoA Disconnect"
/ip firewall filter add chain=input protocol=udp src-address=${radiusServerIp} dst-port=${authPort},1813 action=accept comment="UNZANET-RADIUS Auth Acct"
`.trim();

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

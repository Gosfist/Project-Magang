import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { SaveRouterDto, SaveVpnClientDto, SaveVpnServerDto } from './router.dto.js';
import crypto from 'crypto';
import { MikrotikService } from './mikrotik.service.js';
import os from 'os';

@Injectable()
export class RouterService {
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
          latitude: dto.latitude ?? null,
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
          latitude: dto.latitude ?? null,
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

  // ==========================================
  // 2. Pengelolaan server VPN WireGuard.
  // ==========================================

  async vpnServers(search = '', page = 1) {
    const where: Prisma.VpnServerWhereInput = search
      ? {
          OR: [
            { name: { contains: search } },
            { host: { contains: search } },
            { subnet: { contains: search } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vpnServer.findMany({
        where,
        include: { _count: { select: { clients: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.prisma.vpnServer.count({ where }),
    ]);

    return serialize({
      data: items.map((i) => ({ ...i, clientsCount: i._count.clients })),
      meta: pageMeta(page, 10, total),
    });
  }

  async vpnServerOptions() {
    const data = await this.prisma.vpnServer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        host: true,
        subnet: true,
        wgPort: true,
        wgPublicKey: true,
        poolStart: true,
        poolEnd: true,
      },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  async createVpnServer(dto: SaveVpnServerDto) {
    let keypair = { publicKey: dto.wgPublicKey?.trim(), privateKey: dto.wgPrivateKey?.trim() || null };
    if (!keypair.publicKey) {
      const generated = this.generateWireguardKeyPair();
      keypair.publicKey = generated.publicKey;
      keypair.privateKey = generated.privateKey;
    }

    const now = new Date();
    const item = await this.prisma.vpnServer.create({
      data: {
        name: dto.name.trim(),
        host: dto.host.trim(),
        subnet: dto.subnet?.trim() || '10.200.0.0/24',
        wgPort: dto.wgPort || 51820,
        wgPublicKey: keypair.publicKey,
        wgPrivateKey: keypair.privateKey,
        poolStart: dto.poolStart ?? 10,
        poolEnd: dto.poolEnd ?? 254,
        gateway: dto.gateway?.trim() || null,
        isActive: dto.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      },
    });
    return serialize({ message: 'Server WireGuard berhasil ditambahkan.', server: item });
  }

  async updateVpnServer(id: string, dto: SaveVpnServerDto) {
    await this.findVpnServer(id);
    const item = await this.prisma.vpnServer.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name.trim(),
        host: dto.host.trim(),
        subnet: dto.subnet?.trim() || '10.200.0.0/24',
        wgPort: dto.wgPort || 51820,
        wgPublicKey: dto.wgPublicKey.trim(),
        wgPrivateKey: dto.wgPrivateKey?.trim() || null,
        poolStart: dto.poolStart ?? 10,
        poolEnd: dto.poolEnd ?? 254,
        gateway: dto.gateway?.trim() || null,
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
    });
    return serialize({ message: 'Server WireGuard berhasil diperbarui.', server: item });
  }

  async removeVpnServer(id: string) {
    const current = await this.findVpnServer(id);
    const clientsCount = await this.prisma.vpnClient.count({
      where: { vpnServerId: current.id },
    });
    if (clientsCount > 0) {
      throw new BadRequestException(
        `Server masih memiliki ${clientsCount} client aktif dan tidak dapat dihapus.`,
      );
    }
    await this.prisma.vpnServer.delete({ where: { id: current.id } });
    return { message: 'Server WireGuard berhasil dihapus.' };
  }

  // ==========================================
  // 3. Pengelolaan klien VPN WireGuard.
  // ==========================================

  async vpnClients(search = '', page = 1) {
    const where: Prisma.VpnClientWhereInput = search
      ? {
          OR: [
            { name: { contains: search } },
            { vpnIp: { contains: search } },
            { clientPublicKey: { contains: search } },
            { vpnServer: { name: { contains: search } } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vpnClient.findMany({
        where,
        include: {
          vpnServer: { select: { id: true, name: true, host: true, wgPort: true, wgPublicKey: true } },
          routers: { select: { id: true, name: true, nasname: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.prisma.vpnClient.count({ where }),
    ]);

    return serialize({ data: items, meta: pageMeta(page, 10, total) });
  }

  async vpnClientOptions() {
    const data = await this.prisma.vpnClient.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        vpnIp: true,
        isRadiusServer: true,
      },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  async createVpnClient(dto: SaveVpnClientDto) {
    const server = await this.findVpnServer(dto.vpnServerId);

    let keypair = { publicKey: dto.clientPublicKey?.trim(), privateKey: dto.clientPrivateKey?.trim() || null };
    if (!keypair.publicKey) {
      const generated = this.generateWireguardKeyPair();
      keypair.publicKey = generated.publicKey;
      keypair.privateKey = generated.privateKey;
    }

    const now = new Date();
    try {
      const item = await this.prisma.vpnClient.create({
        data: {
          name: dto.name.trim(),
          vpnServerId: server.id,
          vpnIp: dto.vpnIp.trim(),
          clientPublicKey: keypair.publicKey,
          clientPrivateKey: keypair.privateKey,
          allowedIps: dto.allowedIps?.trim() || '10.200.0.0/24',
          description: dto.description?.trim() || null,
          isRadiusServer: dto.isRadiusServer ?? false,
          isActive: dto.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        },
        include: { vpnServer: true },
      });
      return serialize({ message: 'Klien WireGuard berhasil ditambahkan.', client: item });
    } catch (error) {
      this.unique(error, 'IP klien WireGuard sudah digunakan.');
    }
  }

  async updateVpnClient(id: string, dto: SaveVpnClientDto) {
    await this.findVpnClient(id);
    const server = await this.findVpnServer(dto.vpnServerId);

    try {
      const item = await this.prisma.vpnClient.update({
        where: { id: BigInt(id) },
        data: {
          name: dto.name.trim(),
          vpnServerId: server.id,
          vpnIp: dto.vpnIp.trim(),
          clientPublicKey: dto.clientPublicKey.trim(),
          clientPrivateKey: dto.clientPrivateKey?.trim() || null,
          allowedIps: dto.allowedIps?.trim() || '10.200.0.0/24',
          description: dto.description?.trim() || null,
          isRadiusServer: dto.isRadiusServer ?? false,
          isActive: dto.isActive ?? true,
          updatedAt: new Date(),
        },
        include: { vpnServer: true },
      });
      return serialize({ message: 'Klien WireGuard berhasil diperbarui.', client: item });
    } catch (error) {
      this.unique(error, 'IP klien WireGuard sudah digunakan.');
    }
  }

  async removeVpnClient(id: string) {
    const current = await this.findVpnClient(id);
    await this.prisma.vpnClient.delete({ where: { id: current.id } });
    return { message: 'Klien WireGuard berhasil dihapus.' };
  }

  async getVpnClientScript(id: string) {
    const client = await this.prisma.vpnClient.findUnique({
      where: { id: BigInt(id) },
      include: { vpnServer: true },
    });
    if (!client) throw new NotFoundException('Klien WireGuard tidak ditemukan.');

    const server = client.vpnServer;
    const ifaceName = 'wg-unzanet';
    const clientPrivKeyParam = client.clientPrivateKey
      ? ` private-key="${client.clientPrivateKey}"`
      : ' # (Masukkan kunci privat klien jika tidak otomatis)';

    const script = `
# ============================================================
# Pengaturan Klien WireGuard UNZANET (RouterOS v7+)
# Klien: ${client.name}
# VPN IP: ${client.vpnIp}
# Alamat Server: ${server.host}:${server.wgPort}
# ============================================================

# 1. Buat antarmuka WireGuard
/interface wireguard add name=${ifaceName} listen-port=51820${clientPrivKeyParam} comment="Terowongan WireGuard UNZANET"

# 2. Pasang alamat IP pada antarmuka WireGuard
/ip address add address=${client.vpnIp}/24 interface=${ifaceName} comment="IP Klien WireGuard"

# 3. Daftarkan server sebagai rekan WireGuard
/interface wireguard peers add interface=${ifaceName} public-key="${server.wgPublicKey}" endpoint-address="${server.host}" endpoint-port=${server.wgPort} allowed-address="${client.allowedIps || '10.200.0.0/24'}" persistent-keepalive=25s comment="Server WireGuard UNZANET"
`.trim();

    return serialize({
      clientName: client.name,
      vpnIp: client.vpnIp,
      serverHost: server.host,
      serverPort: server.wgPort,
      serverPublicKey: server.wgPublicKey,
      clientPublicKey: client.clientPublicKey,
      script,
    });
  }

  // ==========================================
  // Fungsi pendukung.
  // ==========================================

  generateWireguardKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    const rawPriv = privDer.subarray(privDer.length - 32);
    const rawPub = pubDer.subarray(pubDer.length - 32);
    return {
      privateKey: rawPriv.toString('base64'),
      publicKey: rawPub.toString('base64'),
    };
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

  private async findVpnServer(id: string) {
    const item = await this.prisma.vpnServer.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Server WireGuard tidak ditemukan.');
    return item;
  }

  private async findVpnClient(id: string) {
    const item = await this.prisma.vpnClient.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Klien WireGuard tidak ditemukan.');
    return item;
  }

  private unique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}

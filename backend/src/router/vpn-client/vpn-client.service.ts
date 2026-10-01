import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';

import { SaveVpnClientDto } from './vpn-client.dto.js';

import crypto from 'crypto';
import { MikrotikService } from '../shared/mikrotik.service.js';

@Injectable()
export class VpnClientService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) { }

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

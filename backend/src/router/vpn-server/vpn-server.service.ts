import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';

import { SaveVpnServerDto } from './vpn-server.dto.js';
import crypto from 'crypto';
import { MikrotikService } from '../shared/mikrotik.service.js';

@Injectable()
export class VpnServerService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) { }

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
}

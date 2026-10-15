import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveVpnClientDto } from './vpn-client.dto.js';
import { MikrotikService } from '../shared/mikrotik.service.js';
import { zeroTierJoinScript } from './zerotier-script.js';

const fields = { id: true, name: true, networkId: true, nodeId: true, deviceType: true,
  vpnIp: true, description: true, isRadiusServer: true, isActive: true,
  routers: { select: { id: true, name: true } } } satisfies Prisma.VpnClientSelect;
const zeroTierWhere = { networkId: { not: null } } satisfies Prisma.VpnClientWhereInput;

@Injectable()
export class VpnClientService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) {}

  async vpnClients(search = '', page = 1) {
    const where: Prisma.VpnClientWhereInput = search ? { OR: [
      { name: { contains: search } }, { vpnIp: { contains: search } },
      { nodeId: { contains: search } }, { networkId: { contains: search } },
    ] } : {};
    const [items, total, members] = await this.prisma.$transaction([
      this.prisma.vpnClient.findMany({ where, select: fields, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10 }),
      this.prisma.vpnClient.count({ where }),
      this.prisma.vpnClient.findMany({ where: zeroTierWhere, select: { networkId: true, isRadiusServer: true } }),
    ]);
    const serverRegistered = members.some(member => member.isRadiusServer);
    // Reserve Ubuntu's slot even before its record has been added. Inactive records still count.
    const used = members.length + (serverRegistered ? 0 : 1);
    return serialize({ data: items, meta: pageMeta(page, 10, total), capacity: {
      used, limit: 10, remaining: Math.max(0, 10 - used), serverRegistered,
      networkId: members[0]?.networkId ?? '',
    } });
  }

  async vpnClientOptions() {
    const data = await this.prisma.vpnClient.findMany({
      where: { ...zeroTierWhere, isActive: true, isRadiusServer: false, deviceType: 'mikrotik', vpnIp: { not: '' }, nodeId: { not: null } },
      select: { id: true, name: true, vpnIp: true }, orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  createVpnClient(dto: SaveVpnClientDto) { return this.save(dto); }
  updateVpnClient(id: string, dto: SaveVpnClientDto) { return this.save(dto, this.id(id)); }

  private async save(dto: SaveVpnClientDto, id?: bigint) {
    try {
      const item = await this.transaction(async tx => {
        const current = id === undefined ? null : await tx.vpnClient.findUnique({ where: { id }, select: fields });
        if (id !== undefined && !current) throw new NotFoundException('Klien VPN tidak ditemukan.');
        const members = await tx.vpnClient.findMany({ where: zeroTierWhere, select: fields });
        const others = members.filter(member => member.id !== id);
        const isRadiusServer = dto.isRadiusServer ?? false;
        const networkId = dto.networkId.trim().toLowerCase();
        const nodeId = dto.nodeId?.trim().toLowerCase() || null;
        const vpnIp = dto.vpnIp?.trim() || '';
        if (isRadiusServer && dto.deviceType !== 'linux') throw new BadRequestException('Server RADIUS harus memakai jenis Ubuntu / Linux.');
        if (others.some(member => member.networkId !== networkId)) throw new BadRequestException('Semua perangkat harus memakai satu Network ID ZeroTier yang sama.');
        if (isRadiusServer && others.some(member => member.isRadiusServer)) throw new BadRequestException('Hanya boleh ada satu perangkat server RADIUS.');
        const used = others.length + 1 + (isRadiusServer || others.some(member => member.isRadiusServer) ? 0 : 1);
        if (used > 10) throw new BadRequestException('Batas 10 perangkat termasuk server RADIUS sudah penuh. Perangkat nonaktif tetap dihitung sampai dikeluarkan dari ZeroTier Central.');
        if (nodeId && others.some(member => member.nodeId === nodeId)) throw new ConflictException('Device ID ZeroTier sudah terdaftar.');
        if (vpnIp && others.some(member => member.vpnIp === vpnIp)) throw new ConflictException('IP ZeroTier sudah terdaftar.');
        if (current?.routers.length && (current.vpnIp !== vpnIp || current.networkId !== networkId || current.nodeId !== nodeId
          || dto.deviceType !== 'mikrotik' || isRadiusServer || dto.isActive === false)) {
          throw new BadRequestException('Lepaskan hubungan Router / NAS terlebih dahulu sebelum mengganti identitas atau menonaktifkan klien.');
        }
        if (current?.isRadiusServer && (current.vpnIp !== vpnIp || current.networkId !== networkId || !isRadiusServer || dto.isActive === false)
          && await tx.nas.count({ where: { vpnClient: { networkId: current.networkId } } })) {
          throw new BadRequestException('Server RADIUS masih digunakan Router / NAS. Lepaskan hubungan VPN router sebelum mengganti server.');
        }
        const data = { name: dto.name.trim(), networkId, nodeId, vpnIp, deviceType: dto.deviceType,
          isRadiusServer, isActive: dto.isActive ?? true, description: dto.description?.trim() || null,
          vpnServerId: null, clientPublicKey: null, clientPrivateKey: null, updatedAt: new Date() };
        return id === undefined
          ? tx.vpnClient.create({ data, select: fields })
          : tx.vpnClient.update({ where: { id }, data, select: fields });
      });
      return serialize({ message: 'Data klien ZeroTier berhasil disimpan. Jalankan setup awal dan otorisasi perangkat di ZeroTier Central.', client: item });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Identitas klien VPN sudah terdaftar.');
      throw error;
    }
  }

  async removeVpnClient(id: string) {
    await this.transaction(async tx => {
      const item = await tx.vpnClient.findUnique({ where: { id: this.id(id) }, select: fields });
      if (!item) throw new NotFoundException('Klien VPN tidak ditemukan.');
      if (item.routers.length || (item.isRadiusServer && await tx.nas.count({ where: { vpnClient: { networkId: item.networkId } } }))) {
        throw new BadRequestException('Klien masih digunakan Router / NAS. Lepaskan hubungannya terlebih dahulu.');
      }
      await tx.vpnClient.delete({ where: { id: item.id } });
    });
    return { message: 'Pencatatan klien dihapus. Lakukan leave pada perangkat dan deauthorize di ZeroTier Central untuk melepaskan slot jaringan.' };
  }

  async getVpnClientScript(id: string) {
    const client = await this.prisma.vpnClient.findUnique({ where: { id: this.id(id) }, select: fields });
    if (!client) throw new NotFoundException('Klien VPN tidak ditemukan.');
    if (!client.networkId) throw new BadRequestException('Data WireGuard lama harus diubah ke ZeroTier terlebih dahulu.');
    const server = await this.prisma.vpnClient.findFirst({ where: { networkId: client.networkId, isRadiusServer: true, isActive: true }, select: { vpnIp: true } });
    const router = client.routers[0] ? await this.prisma.nas.findUnique({ where: { id: client.routers[0].id }, select: { port: true } }) : null;
    return { clientName: client.name, deviceType: client.deviceType, networkId: client.networkId,
      script: zeroTierJoinScript({ ...client, networkId: client.networkId }, server?.vpnIp || '', router?.port || 8728) };
  }

  async checkVpnClient(id: string) {
    const client = await this.prisma.vpnClient.findUnique({ where: { id: this.id(id) }, select: fields });
    if (!client) throw new NotFoundException('Klien VPN tidak ditemukan.');
    if (!client.networkId || client.deviceType !== 'mikrotik' || !client.routers.length) {
      throw new BadRequestException('Hubungkan klien MikroTik ke Router / NAS terlebih dahulu. Ubuntu diperiksa melalui zerotier-cli.');
    }
    const router = await this.prisma.nas.findUnique({ where: { id: client.routers[0].id } });
    if (!router || router.ipAddress !== client.vpnIp) throw new BadRequestException('Alamat API Router / NAS harus sama dengan IP ZeroTier klien.');
    try {
      return await this.mikrotik.withRouter(router, async write => {
        const interfaces = await write('/zerotier/interface/print', ['=.proplist=name,network,status']);
        const iface = interfaces.find(row => row.network === client.networkId);
        const addresses = await write('/ip/address/print', ['=.proplist=address,interface']);
        const success = iface?.status === 'OK' && addresses.some(row => row.interface === iface.name && row.address.split('/')[0] === client.vpnIp);
        return { success, message: success
          ? 'API MikroTik melalui IP ZeroTier terhubung, network OK dan IP cocok. Autentikasi PPPoE/RADIUS perlu diuji terpisah.'
          : 'API MikroTik terhubung, tetapi network ZeroTier belum OK atau IP belum sesuai. Periksa otorisasi dan Managed IP di Central.' };
      });
    } catch (error) { return { success: false, message: this.mikrotik.errorMessage(error) }; }
  }

  // Serializable transactions + retry prevent parallel requests exceeding the limit or creating two RADIUS servers.
  private async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
        throw error;
      }
    }
  }

  private id(value: string): bigint {
    if (!/^[1-9][0-9]*$/.test(value)) throw new BadRequestException('ID klien VPN tidak valid.');
    return BigInt(value);
  }
}

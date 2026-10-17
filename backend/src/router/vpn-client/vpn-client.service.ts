import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveVpnClientDto } from './vpn-client.dto.js';
import { MikrotikService } from '../shared/mikrotik.service.js';
import { assertVpnIp, wireguardClients } from './wireguard-client.js';

const fields = { id: true, name: true, vpnType: true, vpnIp: true, isRadiusServer: true, isActive: true,
  routers: { select: { id: true, name: true } } } satisfies Prisma.VpnClientSelect;
type Client = Prisma.VpnClientGetPayload<{ select: typeof fields }>;
function viewClient({ isRadiusServer, ...client }: Client) {
  return { ...client, deviceType: isRadiusServer ? 'radius' : 'mikrotik' };
}

@Injectable()
export class VpnClientService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) {}

  async vpnClients(search = '', page = 1) {
    const where: Prisma.VpnClientWhereInput = { ...wireguardClients, ...(search ? { OR: [
      { name: { contains: search } }, { vpnIp: { contains: search } },
    ] } : {}) };
    const [items, total, legacyCount] = await Promise.all([
      this.prisma.vpnClient.findMany({ where, select: fields, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10 }),
      this.prisma.vpnClient.count({ where }),
      this.prisma.vpnClient.count({ where: { vpnType: { not: 'wireguard' } } }),
    ]);
    return serialize({ data: items.map(viewClient), meta: pageMeta(page, 10, total), legacyCount });
  }

  async vpnClientOptions() {
    return serialize({ data: await this.prisma.vpnClient.findMany({
      where: { ...wireguardClients, isActive: true, isRadiusServer: false },
      select: { id: true, name: true, vpnIp: true }, orderBy: { name: 'asc' },
    }) });
  }

  createVpnClient(dto: SaveVpnClientDto) { return this.save(dto); }
  updateVpnClient(id: string, dto: SaveVpnClientDto) { return this.save(dto, this.id(id)); }

  private async save(dto: SaveVpnClientDto, id?: bigint) {
    assertVpnIp(dto.vpnIp);
    const item = await this.transaction(async tx => {
      const current = id === undefined ? null : await tx.vpnClient.findUnique({ where: { id }, select: fields });
      if (id !== undefined && (!current || current.vpnType !== 'wireguard')) throw new NotFoundException('Klien WireGuard tidak ditemukan.');
      const isRadiusServer = dto.deviceType === 'radius';
      const isActive = dto.isActive ?? current?.isActive ?? true;
      if (current?.routers.length && (dto.vpnIp !== current.vpnIp || isRadiusServer || !isActive)) {
        throw new BadRequestException('Lepaskan hubungan Router / NAS terlebih dahulu sebelum mengganti IP, jenis perangkat, atau menonaktifkan klien.');
      }
      if (current?.isRadiusServer && (dto.vpnIp !== current.vpnIp || !isRadiusServer || !isActive)) {
        await this.assertServerUnused(tx);
      }
      const others: Prisma.VpnClientWhereInput = { ...wireguardClients, ...(id === undefined ? {} : { id: { not: id } }) };
      if (await tx.vpnClient.findFirst({ where: { ...others, vpnIp: dto.vpnIp }, select: { id: true } })) {
        throw new ConflictException('IP VPN sudah digunakan perangkat lain.');
      }
      if (isRadiusServer && await tx.vpnClient.findFirst({ where: { ...others, isRadiusServer: true }, select: { id: true } })) {
        throw new ConflictException('Server RADIUS sudah terdaftar. Edit catatan server yang ada.');
      }
      const data = { name: `${isRadiusServer ? 'Server RADIUS' : 'MikroTik'} ${dto.vpnIp}`, vpnIp: dto.vpnIp,
        vpnType: 'wireguard', isRadiusServer, isActive, vpnServerId: null, updatedAt: new Date() };
      return id === undefined ? tx.vpnClient.create({ data, select: fields }) : tx.vpnClient.update({ where: { id }, data, select: fields });
    });
    return serialize({ message: 'IP VPN perangkat berhasil disimpan.', client: viewClient(item) });
  }

  async removeVpnClient(id: string) {
    await this.transaction(async tx => {
      const item = await tx.vpnClient.findUnique({ where: { id: this.id(id) }, select: fields });
      if (!item || item.vpnType !== 'wireguard') throw new NotFoundException('Klien WireGuard tidak ditemukan.');
      if (item.routers.length) throw new BadRequestException('Lepaskan hubungan Router / NAS terlebih dahulu.');
      if (item.isRadiusServer) await this.assertServerUnused(tx);
      await tx.vpnClient.delete({ where: { id: item.id } });
    });
    return { message: 'Catatan IP VPN dihapus. Peer WireGuard tetap dikelola di VPS / penyedia VPN.' };
  }

  private async assertServerUnused(tx: Prisma.TransactionClient) {
    if (await tx.nas.count({ where: { vpnClient: wireguardClients } })) {
      throw new BadRequestException('Server RADIUS masih digunakan Router / NAS. Lepaskan hubungan VPN router sebelum mengganti atau menghapus catatan server.');
    }
  }

  async checkVpnClient(id: string) {
    const client = await this.prisma.vpnClient.findUnique({ where: { id: this.id(id) }, select: fields });
    if (!client || client.vpnType !== 'wireguard') throw new NotFoundException('Klien WireGuard tidak ditemukan.');
    if (!client.isActive || client.isRadiusServer || !client.routers.length) {
      throw new BadRequestException('Hubungkan klien MikroTik aktif ke Router / NAS terlebih dahulu.');
    }
    const router = await this.prisma.nas.findUnique({ where: { id: client.routers[0].id } });
    if (!router || router.ipAddress !== client.vpnIp) throw new BadRequestException('IP API Router / NAS harus sama dengan IP VPN klien.');
    try {
      return await this.mikrotik.withRouter(router, async write => {
        // Explicit proplists avoid reading WireGuard private keys or peer preshared keys.
        const identity = await write('/system/identity/print', ['=.proplist=name']);
        const interfaces = await write('/interface/wireguard/print', ['=.proplist=name,disabled']);
        const addresses = await write('/ip/address/print', ['=.proplist=address,interface,disabled']);
        const enabled = (value: string | undefined) => !['true', 'yes'].includes(value || '');
        const configured = addresses.some(address => enabled(address.disabled) && address.address?.split('/')[0] === client.vpnIp
          && interfaces.some(iface => iface.name === address.interface && enabled(iface.disabled)));
        const success = Boolean(identity[0]?.name) && configured;
        return { success, message: success
          ? 'API MikroTik melalui IP VPN terhubung dan IP sesuai interface WireGuard aktif. Autentikasi PPPoE / RADIUS perlu diuji terpisah.'
          : 'API terhubung, tetapi IP VPN belum sesuai interface WireGuard aktif. Periksa IP dan interface pada MikroTik.' };
      });
    } catch (error) { return { success: false, message: this.mikrotik.errorMessage(error) }; }
  }

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

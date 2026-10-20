import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Nas } from '@prisma/client';
import crypto from 'node:crypto';
import { isIPv4 } from 'node:net';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveRouterDto } from './routers.dto.js';
import { radiusSetupScript } from '../shared/radius-setup-script.js';
import { VpnService } from '../vpn/vpn.service.js';
import { VpnStatusService } from '../vpn/vpn-status.service.js';
import { activeNetworkKey, internetPoolName, nasNetwork, nasNetworkScript, networkContains, networkKey, readNasNetwork, isolationPoolName, type NasNetwork } from '../shared/nas-network.js';
import { isolationKey, isolationProfile } from '../../pppoe/shared/isolation-config.js';

@Injectable()
export class RoutersService {
  constructor(private readonly prisma: PrismaService, private readonly vpn?: VpnService, private readonly vpnStatus: VpnStatusService = new VpnStatusService()) {}

  private publicRouter(router: Nas & { _count?: { accounts: number } }) {
    // Explicit allowlist prevents old credentials and RADIUS secrets leaking in list/save responses.
    return {
      id: router.id, name: router.name, nasname: router.nasname, shortname: router.shortname,
      type: router.type, ipAddress: router.ipAddress, ports: router.ports, coaPort: router.coaPort,
      radiusServerIp: router.radiusServerIp, vpnHost: router.vpnHost, vpnUsername: router.vpnUsername, vpnClientId: router.vpnClientId,
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
    const snapshot = await this.vpnStatus.snapshot();
    const networks = await this.prisma.appSetting.findMany({ where: { key: { in: items.flatMap(item => [networkKey(item.id), activeNetworkKey(item.id)]) } } });
    const values = new Map(networks.map(row => [row.key, row.value]));
    return serialize({ data: items.map(item => {
      const raw = values.get(networkKey(item.id));
      let network: NasNetwork | null = null, activeFingerprint: string | null = null;
      const active = values.get(activeNetworkKey(item.id));
      try { network = raw ? JSON.parse(raw) as NasNetwork : null; activeFingerprint = active ? (JSON.parse(active) as NasNetwork).fingerprint : null; } catch { /* Keep the edit form reachable so invalid stored prefixes can be corrected. */ }
      return { ...this.publicRouter(item), ...this.vpnStatus.forRouter(item, snapshot),
        internetCidr: network?.internet?.cidr ?? '', isolationCidr: network?.isolation?.cidr ?? '',
        networkInstalled: !!network && activeFingerprint === network.fingerprint };
    }), meta: pageMeta(page, 10, total) });
  }

  async routerOptions() {
    const data = await this.prisma.nas.findMany({
      where: { isActive: true }, select: { id: true, name: true, nasname: true, shortname: true, description: true, ipAddress: true }, orderBy: { id: 'asc' },
    });
    return serialize({ data: data.map(d => ({ ...d, displayName: d.name || d.shortname || d.nasname })) });
  }

  async createRouter(dto: SaveRouterDto) {
    const managed = await this.managedVpn(dto);
    const data = this.routerData(dto);
    const network = this.networkInput(dto, 0, data.nasname, data.radiusServerIp);
    await this.assertUniqueNas(data.nasname);
    try {
      const item = network ? await this.prisma.$transaction(async tx => {
        const item = await tx.nas.create({ data: { ...data, createdAt: new Date() } });
        await this.saveNetwork(tx, item.id, nasNetwork(item.id, network.internet.cidr, network.isolation.cidr));
        return item;
      }) : await this.prisma.nas.create({ data: { ...data, createdAt: new Date() } });
      return serialize({ message: 'NAS ditambahkan. Salin script ke Terminal MikroTik. Konfigurasi NAS diterapkan FreeRADIUS dalam sekitar 60 detik.', router: this.publicRouter(item), setup: await this.setup(item, dto.vpnPassword, managed ? 4443 : 443) });
    } catch (error) { this.unique(error); }
  }

  async updateRouter(id: string, dto: SaveRouterDto) {
    const current = await this.findRouter(id);
    const managed = await this.managedVpn(dto, current);
    const data = this.routerData(dto, current);
    const network = this.networkInput(dto, current.id, data.nasname, data.radiusServerIp);
    await this.assertUniqueNas(data.nasname, current.id);
    try {
      const item = network ? await this.prisma.$transaction(async tx => {
        const item = await tx.nas.update({ where: { id: current.id }, data });
        await this.saveNetwork(tx, item.id, { ...network, update: true });
        return item;
      }) : await this.prisma.nas.update({ where: { id: current.id }, data });
      return serialize({ message: 'NAS diperbarui. Pasang script perubahan pada router yang sama, lalu konfirmasikan pemasangan pool.', router: this.publicRouter(item), setup: await this.setup(item, dto.vpnPassword, managed ? 4443 : 443, true) });
    } catch (error) { this.unique(error); }
  }

  async removeRouter(id: string) {
    const current = await this.findRouter(id);
    const accountsCount = await this.prisma.pppoeAccount.count({ where: { routerNasId: current.id } });
    if (accountsCount > 0) throw new BadRequestException(`Router masih digunakan oleh ${accountsCount} pelanggan PPPoE dan tidak dapat dihapus.`);
    await this.prisma.nas.delete({ where: { id: current.id } });
    return { message: 'NAS dihapus. FreeRADIUS menerapkan perubahan dalam sekitar 60 detik. Konfigurasi pada perangkat tidak dihapus otomatis.' };
  }

  async getRouterScript(id: string) {
    const router = await this.findRouter(id);
    const managed = router.vpnClientId && this.vpn ? await this.vpn.forRouter(String(router.vpnClientId), router.id) : undefined;
    return serialize(await this.setup(router, managed?.password, managed ? 4443 : 443));
  }

  private async managedVpn(dto: SaveRouterDto, current?: Nas) {
    const id = dto.vpnClientId === undefined ? current?.vpnClientId?.toString() : dto.vpnClientId;
    if (!id) return undefined;
    if (!this.vpn) throw new BadRequestException('Layanan VPN tidak tersedia.');
    const client = await this.vpn.forRouter(id, current?.id);
    Object.assign(dto, { vpnClientId: id, nasname: client.ip, ipAddress: client.ip, radiusServerIp: client.radiusIp, vpnHost: client.host, vpnUsername: client.username, vpnPassword: client.password });
    return client;
  }

  private async setup(router: Nas, vpnPassword?: string, vpnPort = 443, update?: boolean) {
    const radiusServerIp = this.serverIp(router.radiusServerIp);
    const network = await readNasNetwork(this.prisma, router.id, false);
    const active = network ? await readNasNetwork(this.prisma, router.id) : null;
    update ??= !!active || network?.update === true;
    const append = network ? '\n' + nasNetworkScript(router.id, network, update && !!active) : '';
    return {
      routerName: router.name, radiusServerIp, nasSrcAddress: router.nasname,
      authPort: router.ports || 1812, coaPort: router.coaPort || 3799,
      scriptRos7: radiusSetupScript(router, radiusServerIp, router.nasname, true, vpnPassword, vpnPort, update) + append,
      scriptRos6: radiusSetupScript(router, radiusServerIp, router.nasname, false, vpnPassword, vpnPort, update) + append,
      networkFingerprint: network?.fingerprint ?? null,
      networkNeedsConfirmation: !!network && network.fingerprint !== active?.fingerprint,
    };
  }

  private networkInput(dto: SaveRouterDto, id: number, nasIp: string, radiusIp: string) {
    if (dto.internetCidr === undefined && dto.isolationCidr === undefined) return null;
    const network = nasNetwork(id, dto.internetCidr ?? '', dto.isolationCidr ?? '');
    if ([network.internet, network.isolation].some(pool => [nasIp, radiusIp].some(ip => networkContains(pool, ip)))) {
      throw new BadRequestException('Subnet pool pelanggan tidak boleh mencakup IP NAS atau server RADIUS.');
    }
    return network;
  }

  private async saveNetwork(tx: Prisma.TransactionClient, id: number, network: NasNetwork) {
    const previous = await readNasNetwork(tx, id, false);
    if (previous) {
      network.existingPools = previous.existingPools;
      network.existingIsolationProfile = previous.existingIsolationProfile;
    } else {
      const pools = await tx.ipPool.findMany({ where: { routerNasId: id, name: { in: [internetPoolName, isolationPoolName] } } });
      network.existingPools = pools.map(pool => pool.name);
      const isolation = await tx.appSetting.findUnique({ where: { key: isolationKey(id) } });
      network.existingIsolationProfile = !!isolation && (JSON.parse(isolation.value) as { enabled?: boolean }).enabled === true;
    }
    for (const [name, pool] of [[internetPoolName, network.internet], [isolationPoolName, network.isolation]] as const) {
      await tx.ipPool.upsert({ where: { routerNasId_name: { routerNasId: id, name } },
        create: { routerNasId: id, name, networkStart: pool.start, networkEnd: pool.end, createdAt: new Date(), updatedAt: new Date() },
        update: { networkStart: pool.start, networkEnd: pool.end, updatedAt: new Date() } });
    }
    const value = JSON.stringify(network);
    await tx.appSetting.upsert({ where: { key: networkKey(id) }, create: { key: networkKey(id), value }, update: { value } });
  }

  async confirmNetwork(id: string, fingerprint: string) {
    const router = await this.findRouter(id);
    await this.prisma.$transaction(async tx => {
      const network = await readNasNetwork(tx, router.id, false);
      if (!network || network.fingerprint !== fingerprint) throw new ConflictException('Prefix pool berubah. Buka script terbaru sebelum konfirmasi pemasangan.');
      const active = await readNasNetwork(tx, router.id);
      if (active?.fingerprint === network.fingerprint) return;
      const previous = await tx.appSetting.findUnique({ where: { key: isolationKey(router.id) } });
      if (previous && (JSON.parse(previous.value) as { syncPending?: boolean }).syncPending) {
        throw new ConflictException('Tunggu sinkronisasi pool sebelumnya selesai sebelum mengonfirmasi prefix baru.');
      }
      const config = { enabled: true, poolName: isolationPoolName, subnet: network.isolation.subnet,
        localAddress: network.isolation.gateway, profileName: isolationProfile(router.id), syncPending: true };
      for (const [key, data] of [[activeNetworkKey(router.id), network], [isolationKey(router.id), config]] as const) {
        const value = JSON.stringify(data);
        await tx.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { message: 'Pemasangan dikonfirmasi. RADIUS akan menyinkronkan pool internet dan isolir serta sesi pelanggan secara berkala.' };
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
      vpnClientId: dto.vpnClientId ? BigInt(dto.vpnClientId) : null,
      shortname: dto.shortname?.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32),
      type: 'mikrotik', description: dto.description?.trim() || null,
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

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta } from '../../common/serialize.js';

import { SaveIpPoolDto } from './ip-pools.dto.js';
import { RadiusService } from '../shared/radius.service.js';
import { SecretService } from '../shared/secret.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';

import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';

@Injectable()
export class IpPoolsService {
  private readonly logger = new Logger(IpPoolsService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  async ipPools(search = '', page = 1) {
    const result = await this.network.listPools();
    const items = result.data.filter((pool) => `${pool.name} ${pool.routerName}`.toLowerCase().includes(search.toLowerCase()));
    return { data: items.slice((page - 1) * 10, page * 10), meta: pageMeta(page, 10, items.length), warnings: result.warnings };
  }

  async ipPoolOptions() { return this.network.listPools(); }

  async createIpPool(dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    await this.network.poolRouter(dto.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?name=${dto.name}`, '=.proplist=.id,name']);
      if (rows.some((row) => row.name === dto.name)) throw new BadRequestException('Nama pool sudah digunakan di MikroTik ini.');
      await write('/ip/pool/add', [`=name=${dto.name}`, `=ranges=${dto.networkStart}-${dto.networkEnd}`, '=comment=UNZANET PPPoE']);
    });
    return { message: 'IP Pool berhasil dibuat langsung di MikroTik.' };
  }

  async updateIpPool(id: string, dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    const identity = this.network.poolIdentity(id);
    if (identity.routerNasId !== dto.routerNasId) throw new BadRequestException('Router pool tidak dapat dipindahkan.');
    await this.network.poolRouter(identity.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?.id=${identity.routerId}`, '=.proplist=.id,name']);
      const pool = rows.find((row) => row['.id'] === identity.routerId);
      if (!pool) throw new NotFoundException('IP Pool tidak ditemukan di MikroTik.');
      if (pool.name !== dto.name) await this.assertPoolUnused(pool.name);
      await write('/ip/pool/set', [`=.id=${identity.routerId}`, `=name=${dto.name}`, `=ranges=${dto.networkStart}-${dto.networkEnd}`]);
    });
    return { message: 'IP Pool berhasil diperbarui di MikroTik.' };
  }

  private async assertPoolUnused(name: string) {
    if (await this.prisma.pppoePackage.count({ where: { OR: [{ addressPool: name }, { ipPool: { name } }] } })) {
      throw new BadRequestException('IP Pool masih digunakan harga paket. Pindahkan harga paket sebelum mengganti nama atau menghapus pool.');
    }
  }

  private validatePoolRange(dto: SaveIpPoolDto) {
    const numeric = (ip: string) => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
    if (numeric(dto.networkStart) > numeric(dto.networkEnd)) throw new BadRequestException('Awal rentang IP harus lebih kecil atau sama dengan akhir rentang IP.');
  }

  async removeIpPool(id: string) {
    const identity = this.network.poolIdentity(id);
    await this.network.poolRouter(identity.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?.id=${identity.routerId}`, '=.proplist=.id,name']);
      const pool = rows.find((row) => row['.id'] === identity.routerId);
      if (!pool) throw new NotFoundException('IP Pool tidak ditemukan di MikroTik.');
      await this.assertPoolUnused(pool.name);
      await write('/ip/pool/remove', [`=.id=${identity.routerId}`]);
    });
    return { message: 'IP Pool berhasil dihapus dari MikroTik.' };
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta } from '../../common/serialize.js';
import { SaveIpPoolDto } from './ip-pools.dto.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';
import { isolationPoolInUse, ipNumber } from '../shared/isolation-config.js';
import { poolScript, rosQuote } from '../shared/router-script.js';

@Injectable()
export class IpPoolsService {
  constructor(private readonly prisma: PrismaService, private readonly network: PppoeNetworkService) {}
  async ipPools(search = '', page = 1) {
    const result = await this.network.listPools();
    const items = result.data.filter(pool => `${pool.name} ${pool.routerName}`.toLowerCase().includes(search.toLowerCase()));
    return { data: items.slice((page - 1) * 10, page * 10), meta: pageMeta(page, 10, items.length), warnings: result.warnings };
  }
  async ipPoolOptions() { return this.network.listPools(); }
  private async validate(dto: SaveIpPoolDto) {
    if (ipNumber(dto.networkStart) > ipNumber(dto.networkEnd)) throw new BadRequestException('Awal rentang IP harus lebih kecil atau sama dengan akhir rentang IP.');
    const router = await this.prisma.nas.findUnique({ where: { id: dto.routerNasId } });
    if (!router?.isActive) throw new BadRequestException('Pilih Router/NAS aktif.');
  }
  async createIpPool(dto: SaveIpPoolDto) {
    await this.validate(dto);
    try {
      const pool = await this.prisma.ipPool.create({ data: { ...dto, createdAt: new Date(), updatedAt: new Date() } });
      return { message: 'IP Pool terdaftar. Pasang script pada router tujuan.', script: poolScript(pool) };
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Nama pool sudah terdaftar pada NAS ini.'); throw error; }
  }
  private async find(id: string) {
    if (!/^\d+$/.test(id)) throw new BadRequestException('ID pool tidak valid. Muat ulang daftar pool.');
    const pool = await this.prisma.ipPool.findUnique({ where: { id: BigInt(id) } });
    if (!pool) throw new NotFoundException('IP Pool terdaftar tidak ditemukan.');
    return pool;
  }
  async updateIpPool(id: string, dto: SaveIpPoolDto) {
    await this.validate(dto);
    const current = await this.find(id);
    if (current.routerNasId !== null && current.routerNasId !== dto.routerNasId) throw new BadRequestException('Router pool tidak dapat dipindahkan.');
    if (await isolationPoolInUse(this.prisma, current.name, current.routerNasId ?? undefined)) throw new BadRequestException('Pool isolir aktif/pending tidak dapat diubah.');
    if (current.name !== dto.name) await this.assertUnused(current.name);
    try {
      const pool = await this.prisma.ipPool.update({ where: { id: current.id }, data: { ...dto, updatedAt: new Date() } });
      return { message: 'Rencana pool diperbarui. Pasang script pada router; perubahan belum diverifikasi.', script: poolScript(pool, current.name) };
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Nama pool sudah terdaftar pada NAS ini.'); throw error; }
  }
  private async assertUnused(name: string) {
    if (await this.prisma.pppoePackage.count({ where: { OR: [{ addressPool: name }, { ipPool: { name } }] } })) throw new BadRequestException('IP Pool masih digunakan harga paket. Pindahkan harga paket terlebih dahulu.');
  }
  async removeIpPool(id: string) {
    const current = await this.find(id);
    await this.assertUnused(current.name);
    if (await isolationPoolInUse(this.prisma, current.name, current.routerNasId ?? undefined)) throw new BadRequestException('Pool isolir aktif/pending tidak dapat dihapus.');
    await this.prisma.ipPool.delete({ where: { id: current.id } });
    const tag = `UNZANET-POOL:${current.routerNasId}:${current.id}`;
    const script = ['# Jalankan hanya pada NAS tujuan setelah memeriksa pool tidak digunakan.', '{',
      `:local item [/ip pool find where name=${rosQuote(current.name)} and comment=${rosQuote(tag)}];`,
      ':if ([:len $item] = 1) do={ /ip pool remove $item; } else={ :put "Pool nonkelola/tidak ditemukan. Periksa manual."; };', '}'].join('\n');
    return { message: 'Pool dihapus dari daftar aplikasi. Penghapusan pada router memerlukan script/manual.', script };
  }
}

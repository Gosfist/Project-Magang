import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MikrotikService, type RouterCommand } from '../shared/mikrotik.service.js';
import { ISOLATION_COMMENT } from '../../pppoe/shared/isolation-config.js';

export const FIREWALL_READ_ONLY = new Set(['bytes', 'packets', 'dynamic', 'invalid', 'builtin', 'creation-time', 'last-seen', 'expires-after']);
const tables = new Set(['filter', 'nat', 'mangle', 'raw', 'address-list']);

@Injectable()
export class FirewallService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) {}

  private path(family: string, table: string) {
    if (!['ip', 'ipv6'].includes(family) || !tables.has(table)) throw new BadRequestException('Tabel firewall tidak valid.');
    return `/${family}/firewall/${table}`;
  }
  private id(id: string) {
    if (!/^\*[a-f\d]+$/i.test(id)) throw new BadRequestException('ID rule tidak valid. Muat ulang firewall.');
    return id;
  }
  private async run<T>(routerId: number, action: (write: RouterCommand) => Promise<T>) {
    const router = await this.prisma.nas.findUnique({ where: { id: routerId } });
    if (!router || !router.isActive) throw new NotFoundException('Router aktif tidak ditemukan.');
    try { return await this.mikrotik.withRouter(router, action); }
    catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new BadGatewayException(this.mikrotik.errorMessage(error));
    }
  }
  private async editable(write: RouterCommand, path: string, id: string) {
    const rows = await write(`${path}/print`, [`?.id=${this.id(id)}`]);
    const row = rows.find(item => item['.id'] === id);
    if (!row) throw new NotFoundException('Rule tidak ditemukan. Muat ulang firewall.');
    if (row.dynamic === 'true' || row.builtin === 'true') throw new BadRequestException('Rule dinamis/bawaan hanya dapat dilihat.');
    if (row.comment?.startsWith(ISOLATION_COMMENT)) throw new BadRequestException('Kelola rule isolir melalui pengaturan Isolir PPPoE.');
    return row;
  }
  private words(fields: Record<string, string>) {
    const entries = Object.entries(fields);
    if (!entries.length || entries.length > 100) throw new BadRequestException('Isi 1 sampai 100 properti rule.');
    return entries.map(([key, value]) => {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(key) || FIREWALL_READ_ONLY.has(key) || ['numbers', 'place-before', 'copy-from'].includes(key)
        || typeof value !== 'string' || value.length > 4096 || /[\x00\r\n]/.test(value)) throw new BadRequestException(`Properti rule tidak valid: ${key.slice(0, 64)}.`);
      if (key === 'comment' && value.startsWith(ISOLATION_COMMENT)) throw new BadRequestException('Prefix komentar isolir dicadangkan sistem.');
      return `=${key}=${value}`;
    });
  }
  list(routerId: number, family: string, table: string) {
    const path = this.path(family, table);
    return this.run(routerId, async write => ({ data: await write(`${path}/print`) }));
  }
  create(routerId: number, family: string, table: string, fields: Record<string, string>) {
    const path = this.path(family, table), words = this.words(fields);
    return this.run(routerId, async write => { await write(`${path}/add`, words); return { message: 'Rule ditambahkan di MikroTik.' }; });
  }
  update(routerId: number, family: string, table: string, id: string, fields: Record<string, string>) {
    const path = this.path(family, table), words = this.words(fields);
    return this.run(routerId, async write => { await this.editable(write, path, id); await write(`${path}/set`, [`=.id=${id}`, ...words]); return { message: 'Rule diperbarui di MikroTik.' }; });
  }
  remove(routerId: number, family: string, table: string, id: string) {
    const path = this.path(family, table);
    return this.run(routerId, async write => { await this.editable(write, path, id); await write(`${path}/remove`, [`=.id=${id}`]); return { message: 'Rule dihapus dari MikroTik.' }; });
  }
  move(routerId: number, family: string, table: string, id: string, beforeId: string) {
    const path = this.path(family, table);
    if (table === 'address-list') throw new BadRequestException('Address List tidak memiliki prioritas rule.');
    if (beforeId !== 'end') this.id(beforeId);
    if (id === beforeId) throw new BadRequestException('Pilih rule tujuan yang berbeda.');
    return this.run(routerId, async write => {
      await this.editable(write, path, id);
      const rows = await write(`${path}/print`);
      const destination = rows.find(row => row['.id'] === beforeId);
      if (beforeId !== 'end' && !destination) throw new NotFoundException('Rule tujuan tidak ditemukan.');
      const lastManaged = rows.reduce((index, row, at) => row.comment?.startsWith(ISOLATION_COMMENT) ? at : index, -1);
      if (destination && (destination.dynamic === 'true' || destination.builtin === 'true' || rows.indexOf(destination) <= lastManaged)) throw new BadRequestException('Pilih posisi setelah rule isolir/bawaan.');
      await write(`${path}/move`, [`=.id=${id}`, ...(beforeId === 'end' ? [] : [`=destination=${beforeId}`])]);
      return { message: 'Urutan rule diperbarui di MikroTik.' };
    });
  }
}

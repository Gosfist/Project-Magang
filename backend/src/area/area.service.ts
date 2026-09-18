import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { AssignCollectorDto, SaveAreaDto } from './area.dto.js';

@Injectable()
export class AreaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search = '', page = 1, perPage = 10) {
    const where: Prisma.AreaWhereInput = search
      ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.area.findMany({
        where,
        include: {
          collectors: {
            include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
          },
          _count: { select: { accounts: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.area.count({ where }),
    ]);
    return serialize({
      data: data.map((area) => ({
        ...area,
        accountsCount: area._count.accounts,
      })),
      meta: pageMeta(page, perPage, total),
    });
  }

  async options() {
    const data = await this.prisma.area.findMany({
      select: {
        id: true,
        name: true,
        collectors: {
          select: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  async create(dto: SaveAreaDto) {
    try {
      const area = await this.prisma.area.create({
        data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      });
      return serialize({ message: 'Area berhasil ditambahkan.', area });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Nama area sudah digunakan.');
      }
      throw error;
    }
  }

  async update(id: string, dto: SaveAreaDto) {
    await this.findArea(id);
    try {
      const area = await this.prisma.area.update({
        where: { id: BigInt(id) },
        data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      });
      return serialize({ message: 'Area berhasil diperbarui.', area });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Nama area sudah digunakan.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findArea(id);
    const accountCount = await this.prisma.pppoeAccount.count({ where: { areaId: BigInt(id) } });
    if (accountCount > 0) {
      throw new BadRequestException('Area masih memiliki pelanggan terdaftar dan tidak dapat dihapus.');
    }
    await this.prisma.area.delete({ where: { id: BigInt(id) } });
    return { message: 'Area berhasil dihapus.' };
  }

  async assignCollector(areaId: string, dto: AssignCollectorDto) {
    await this.findArea(areaId);
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(dto.userId) } });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan.');
    if (user.role !== 'kolektor') throw new BadRequestException('Hanya pengguna dengan role kolektor yang dapat ditugaskan ke area.');
    try {
      await this.prisma.areaCollector.create({
        data: { areaId: BigInt(areaId), userId: BigInt(dto.userId) },
      });
      return { message: `Kolektor ${user.name} berhasil ditugaskan ke area.` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Kolektor sudah ditugaskan ke area ini.');
      }
      throw error;
    }
  }

  async removeCollector(areaId: string, userId: string) {
    const deleted = await this.prisma.areaCollector.deleteMany({
      where: { areaId: BigInt(areaId), userId: BigInt(userId) },
    });
    if (deleted.count === 0) throw new NotFoundException('Kolektor tidak ditemukan di area ini.');
    return { message: 'Kolektor berhasil dihapus dari area.' };
  }

  async collectorOptions() {
    const data = await this.prisma.user.findMany({
      where: { role: 'kolektor', status: 'active' },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  private async findArea(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id: BigInt(id) } });
    if (!area) throw new NotFoundException('Area tidak ditemukan.');
    return area;
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { storeImage } from '../common/image-storage.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async salesSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [activeSales, inactiveSales, monthRegistrations, sales, monthlyGroups, totalGroups] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { role: 'sales', status: 'active' } }),
        this.prisma.user.count({ where: { role: 'sales', status: 'inactive' } }),
        this.prisma.psbOrder.count({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: monthStart, lt: nextMonthStart },
          },
        }),
        this.prisma.user.findMany({
          where: { role: 'sales' },
          omit: { password: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.psbOrder.groupBy({
          by: ['salesUserId'],
          where: {
            status: 'COMPLETED',
            completedAt: { gte: monthStart, lt: nextMonthStart },
          },
          _count: { _all: true },
        }),
        this.prisma.psbOrder.groupBy({
          by: ['salesUserId'],
          where: { status: 'COMPLETED' },
          _count: { _all: true },
        }),
      ]);

    const monthlyMap = new Map(monthlyGroups.map((item) => [item.salesUserId.toString(), item._count._all]));
    const totalMap = new Map(totalGroups.map((item) => [item.salesUserId.toString(), item._count._all]));

    return serialize({
      summary: {
        activeSales,
        inactiveSales,
        monthRegistrations,
      },
      data: sales.map((item) => ({
        ...item,
        monthRegistrations: monthlyMap.get(item.id.toString()) ?? 0,
        totalRegistrations: totalMap.get(item.id.toString()) ?? 0,
      })),
    });
  }

  async list(search = '', role = '', status = '', page = 1, perPage = 15) {
    const where: Prisma.UserWhereInput = {
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        omit: { password: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return serialize({ data, meta: pageMeta(page, perPage, total) });
  }

  async create(dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: { ...dto, photo: null, password: await hash(dto.password, 12) },
        omit: { password: true },
      });
      const photo = await storeImage(dto.photo, 'profile', String(user.id));
      const saved = photo ? await this.prisma.user.update({ where: { id: user.id }, data: { photo }, omit: { password: true } }) : user;
      return serialize({ message: 'Petugas berhasil ditambahkan.', user: saved });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email sudah digunakan.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.exists(id);
    const password = dto.password ? await hash(dto.password, 12) : undefined;
    const photo = await storeImage(dto.photo, 'profile', id);
    try {
      const user = await this.prisma.user.update({
        where: { id: BigInt(id) },
        data: { ...dto, photo, password },
        omit: { password: true },
      });
      return serialize({ message: 'Data akun berhasil diperbarui.', user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email sudah digunakan.');
      }
      throw error;
    }
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('Anda tidak bisa menghapus akun sendiri.');
    await this.exists(id);
    await this.prisma.user.delete({ where: { id: BigInt(id) } });
    return { message: 'Petugas berhasil dihapus.' };
  }

  private async exists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user) throw new NotFoundException('Petugas tidak ditemukan.');
  }
}

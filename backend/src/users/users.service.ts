import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
        data: { ...dto, password: await hash(dto.password, 12) },
        omit: { password: true },
      });
      return serialize({ message: 'Petugas berhasil ditambahkan.', user });
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
    try {
      const user = await this.prisma.user.update({
        where: { id: BigInt(id) },
        data: { ...dto, password },
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

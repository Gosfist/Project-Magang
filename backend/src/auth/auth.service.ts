import { Injectable, NotFoundException, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto, UpdateProfileDto } from './auth.dto.js';
import { serialize } from '../common/serialize.js';
import { storeImage, uploadsDirectory } from '../common/image-storage.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) { }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email atau kata sandi salah.');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Akun Anda tidak aktif. Hubungi administrator.');
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id.toString(), role: user.role });
    const { password: _password, ...safeUser } = user;
    return serialize({ message: 'Berhasil masuk.', user: safeUser, accessToken, tokenType: 'Bearer' });
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const { password: _password, ...safeUser } = user;
    return serialize({ user: safeUser });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const password = dto.password ? await hash(dto.password, 12) : undefined;
    const photo = await storeImage(dto.photo, 'profile', id);
    const user = await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        phone: dto.phone || null,
        photo,
        ...(password ? { password } : {}),
      },
    });
    const { password: _password, ...safeUser } = user;
    return serialize({ message: 'Pengaturan akun berhasil disimpan.', user: safeUser });
  }

  async profilePhoto(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(id) }, select: { photo: true, status: true } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const match = /^\/uploads\/profile\/([A-Za-z0-9_-]+\.(jpg|png|webp))$/.exec(user.photo ?? '');
    if (!match) throw new NotFoundException('Foto profil belum tersedia.');
    let buffer: Buffer;
    try { buffer = await readFile(join(uploadsDirectory(), 'profile', match[1])); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('File foto profil tidak ditemukan.');
      throw error;
    }
    return new StreamableFile(buffer, { type: match[2] === 'jpg' ? 'image/jpeg' : `image/${match[2]}`, disposition: 'inline' });
  }
}

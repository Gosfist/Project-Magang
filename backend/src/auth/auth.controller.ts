import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, UpdateProfileDto } from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthRequest } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() { return { message: 'Berhasil keluar.' }; }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthRequest) {
    return this.auth.me(request.user.id);
  }

  @Get('time')
  @UseGuards(JwtAuthGuard)
  time() {
    return { now: new Date().toISOString() };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() request: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.id, dto);
  }
}

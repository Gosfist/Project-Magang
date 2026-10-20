import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { VpnService } from './vpn.service.js';

export class CreateVpnDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) username: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_!@%+=.,:-]{12,128}$/) password?: string;
}

@Controller('router/vpn-clients')
@UseGuards(JwtAuthGuard, AdminGuard)
export class VpnController {
  constructor(private readonly vpn: VpnService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list() { return this.vpn.list(); }
  @Post() @Header('Cache-Control', 'private, no-store') create(@Body() dto: CreateVpnDto) { return this.vpn.create(dto.name, dto.username, dto.password); }
  @Get(':id/credentials') @Header('Cache-Control', 'private, no-store') credentials(@Param('id') id: string) { return this.vpn.credentials(id); }
}

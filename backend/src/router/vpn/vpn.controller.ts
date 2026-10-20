import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { VpnService } from './vpn.service.js';

export class CreateVpnDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) username: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_!@%+=.,:-]{12,128}$/) password?: string;
}

export class UpdateVpnDto extends CreateVpnDto {}

@Controller('router/vpn-clients')
@UseGuards(JwtAuthGuard, AdminGuard)
export class VpnController {
  constructor(private readonly vpn: VpnService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(@Query('credentials') credentials?: string) { return this.vpn.list(credentials === '1'); }
  @Post() @Header('Cache-Control', 'private, no-store') create(@Body() dto: CreateVpnDto) { return this.vpn.create(dto.name, dto.username, dto.password); }
  @Get(':id/credentials') @Header('Cache-Control', 'private, no-store') credentials(@Param('id') id: string) { return this.vpn.credentials(id); }
  @Patch(':id') @Header('Cache-Control', 'private, no-store') update(@Param('id') id: string, @Body() dto: UpdateVpnDto) { return this.vpn.update(id, dto.name, dto.username, dto.password); }
  @Delete(':id') @Header('Cache-Control', 'private, no-store') remove(@Param('id') id: string) { return this.vpn.remove(id); }
}

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { VpnServerService } from './vpn-server.service.js';

import { SaveVpnServerDto } from './vpn-server.dto.js';

@Controller('router')
@UseGuards(JwtAuthGuard, AdminGuard)
export class VpnServerController {
  constructor(private readonly routerService: VpnServerService) {}

  // ==========================================
  // 2. Server VPN WireGuard.
  // ==========================================

  @Get('vpn-server/options')
  vpnServerOptions() {
    return this.routerService.vpnServerOptions();
  }

  @Get('vpn-server/keypair')
  generateServerKeypair() {
    return this.routerService.generateWireguardKeyPair();
  }

  @Get('vpn-server')
  vpnServers(
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.routerService.vpnServers(search.trim(), Math.max(1, page));
  }

  @Post('vpn-server')
  createVpnServer(@Body() dto: SaveVpnServerDto) {
    return this.routerService.createVpnServer(dto);
  }

  @Patch('vpn-server/:id')
  updateVpnServer(@Param('id') id: string, @Body() dto: SaveVpnServerDto) {
    return this.routerService.updateVpnServer(id, dto);
  }

  @Delete('vpn-server/:id')
  removeVpnServer(@Param('id') id: string) {
    return this.routerService.removeVpnServer(id);
  }
}

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { VpnClientService } from './vpn-client.service.js';

import { SaveVpnClientDto } from './vpn-client.dto.js';

@Controller('router')
@UseGuards(JwtAuthGuard, AdminGuard)
export class VpnClientController {
  constructor(private readonly routerService: VpnClientService) {}

  // ==========================================
  // 3. Klien VPN WireGuard.
  // ==========================================

  @Get('vpn-client/options')
  vpnClientOptions() {
    return this.routerService.vpnClientOptions();
  }

  @Get('vpn-client/keypair')
  generateClientKeypair() {
    return this.routerService.generateWireguardKeyPair();
  }

  @Get('vpn-client')
  vpnClients(
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.routerService.vpnClients(search.trim(), Math.max(1, page));
  }

  @Post('vpn-client')
  createVpnClient(@Body() dto: SaveVpnClientDto) {
    return this.routerService.createVpnClient(dto);
  }

  @Patch('vpn-client/:id')
  updateVpnClient(@Param('id') id: string, @Body() dto: SaveVpnClientDto) {
    return this.routerService.updateVpnClient(id, dto);
  }

  @Delete('vpn-client/:id')
  removeVpnClient(@Param('id') id: string) {
    return this.routerService.removeVpnClient(id);
  }

  @Get('vpn-client/:id/script')
  getVpnClientScript(@Param('id') id: string) {
    return this.routerService.getVpnClientScript(id);
  }
}

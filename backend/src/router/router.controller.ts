import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RouterService } from './router.service.js';
import { SaveRouterDto, SaveVpnClientDto, SaveVpnServerDto } from './router.dto.js';

@Controller('router')
@UseGuards(JwtAuthGuard)
export class RouterController {
  constructor(private readonly routerService: RouterService) {}

  // ==========================================
  // 1. ROUTER / NAS
  // ==========================================

  @Get('nas/options')
  routerOptions() {
    return this.routerService.routerOptions();
  }

  @Get('nas')
  routers(
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.routerService.routers(search.trim(), Math.max(1, page));
  }

  @Post('nas')
  createRouter(@Body() dto: SaveRouterDto) {
    return this.routerService.createRouter(dto);
  }

  @Patch('nas/:id')
  updateRouter(@Param('id') id: string, @Body() dto: SaveRouterDto) {
    return this.routerService.updateRouter(id, dto);
  }

  @Delete('nas/:id')
  removeRouter(@Param('id') id: string) {
    return this.routerService.removeRouter(id);
  }

  @Post('nas/:id/test')
  testConnection(@Param('id') id: string) {
    return this.routerService.testConnection(id);
  }

  @Get('nas/:id/script')
  getRouterScript(@Param('id') id: string) {
    return this.routerService.getRouterScript(id);
  }

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

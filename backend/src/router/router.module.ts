import { Module } from '@nestjs/common';
import { VpnServerController } from './vpn-server/vpn-server.controller.js';
import { VpnServerService } from './vpn-server/vpn-server.service.js';
import { VpnClientController } from './vpn-client/vpn-client.controller.js';
import { VpnClientService } from './vpn-client/vpn-client.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoutersController } from './routers/routers.controller.js';
import { RoutersService } from './routers/routers.service.js';
import { MikrotikService } from './shared/mikrotik.service.js';
import { FirewallController } from './firewall/firewall.controller.js';
import { FirewallService } from './firewall/firewall.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RoutersController, VpnServerController, VpnClientController, FirewallController],
  providers: [RoutersService, VpnServerService, VpnClientService, MikrotikService, FirewallService],
  exports: [RoutersService, MikrotikService],
})
export class RouterModule {}

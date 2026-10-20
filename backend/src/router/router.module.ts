import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoutersController } from './routers/routers.controller.js';
import { RoutersService } from './routers/routers.service.js';
import { VpnController } from './vpn/vpn.controller.js';
import { VpnService } from './vpn/vpn.service.js';
import { SecretService } from '../pppoe/shared/secret.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RoutersController, VpnController],
  providers: [RoutersService, VpnService, SecretService],
  exports: [RoutersService],
})
export class RouterModule {}

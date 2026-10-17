import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoutersController } from './routers/routers.controller.js';
import { RoutersService } from './routers/routers.service.js';
import { MikrotikService } from './shared/mikrotik.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RoutersController],
  providers: [RoutersService, MikrotikService],
  exports: [RoutersService, MikrotikService],
})
export class RouterModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RouterController } from './router.controller.js';
import { RouterService } from './router.service.js';
import { MikrotikService } from './mikrotik.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RouterController],
  providers: [RouterService, MikrotikService],
  exports: [RouterService, MikrotikService],
})
export class RouterModule {}

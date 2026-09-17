import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { RouterModule } from '../router/router.module.js';
import { MonitoringController } from './monitoring.controller.js';
import { MonitoringService, MonitoringInterceptor } from './monitoring.service.js';
import { ServerStatsService } from './server-stats.service.js';
import { RouterMonitoringService } from './router-monitoring.service.js';
import { StatsCollectorService } from './stats-collector.service.js';

@Module({
  imports: [AuthModule, RouterModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    ServerStatsService,
    RouterMonitoringService,
    StatsCollectorService,
    { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor },
  ],
  exports: [MonitoringService, ServerStatsService, RouterMonitoringService],
})
export class MonitoringModule {}

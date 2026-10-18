import { Module } from '@nestjs/common';
import { RadiusMonitoringController } from './radius/radius-monitoring.controller.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { MonitoringController } from './server/server.controller.js';
import { MonitoringService, MonitoringInterceptor } from './server/server.service.js';
import { ServerStatsService } from './server/server-stats.service.js';
import { StatsCollectorService } from './shared/stats-collector.service.js';
import { RadiusMonitoringService } from './radius/radius-monitoring.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MonitoringController, RadiusMonitoringController],
  providers: [
    MonitoringService,
    ServerStatsService,
    RadiusMonitoringService,
    StatsCollectorService,
    { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor },
  ],
  exports: [MonitoringService, ServerStatsService, RadiusMonitoringService],
})
export class MonitoringModule {}

import { Module } from '@nestjs/common';
import { RouterMonitoringController } from './router/router-monitoring.controller.js';
import { RadiusMonitoringController } from './radius/radius-monitoring.controller.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { RouterModule } from '../router/router.module.js';
import { MonitoringController } from './server/server.controller.js';
import { MonitoringService, MonitoringInterceptor } from './server/server.service.js';
import { ServerStatsService } from './server/server-stats.service.js';
import { RouterMonitoringService } from './router/router-monitoring.service.js';
import { StatsCollectorService } from './shared/stats-collector.service.js';
import { RadiusMonitoringService } from './radius/radius-monitoring.service.js';

@Module({
  imports: [AuthModule, RouterModule],
  controllers: [MonitoringController, RouterMonitoringController, RadiusMonitoringController],
  providers: [
    MonitoringService,
    ServerStatsService,
    RouterMonitoringService,
    RadiusMonitoringService,
    StatsCollectorService,
    { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor },
  ],
  exports: [MonitoringService, ServerStatsService, RouterMonitoringService, RadiusMonitoringService],
})
export class MonitoringModule {}

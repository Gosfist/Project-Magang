import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { MonitoringService } from '../server/server.service.js';
import { ServerStatsService } from '../server/server-stats.service.js';

import { RouterMonitoringService } from '../router/router-monitoring.service.js';
import { RadiusMonitoringService } from './radius-monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RadiusMonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly serverStats: ServerStatsService,
    private readonly routerMonitoring: RouterMonitoringService,
    private readonly radiusMonitoring: RadiusMonitoringService,
  ) {}

  @Get('radius/logs')
  radiusLogs(@Query('search') search = '', @Query('reply') reply = '', @Query('page') page = '1') {
    return this.radiusMonitoring.logs(search, reply, Number(page));
  }
}

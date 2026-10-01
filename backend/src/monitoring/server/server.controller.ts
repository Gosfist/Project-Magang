import { Controller, Get, Query, Sse, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { MonitoringService } from './server.service.js';
import { ServerStatsService } from './server-stats.service.js';
import type { PeriodeMonitoring } from './server-stats.service.js';
import { RouterMonitoringService } from '../router/router-monitoring.service.js';
import { RadiusMonitoringService } from '../radius/radius-monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly serverStats: ServerStatsService,
    private readonly routerMonitoring: RouterMonitoringService,
    private readonly radiusMonitoring: RadiusMonitoringService,
  ) {}

  @Sse('server/stream')
  @Header('X-Accel-Buffering', 'no')
  stream() { return this.monitoring.stream; }

  @Get('activities')
  activities(@Query('search') search = '', @Query('module') module = '', @Query('page') page = '1') {
    return this.monitoring.activities(search, module, Number(page));
  }

  @Get('server')
  server() {
    return this.monitoring.snapshot();
  }

  @Get('server/stats')
  serverStatistics(@Query('periode') periode?: PeriodeMonitoring) {
    return this.serverStats.getStats(periode || 'hari_ini');
  }
}

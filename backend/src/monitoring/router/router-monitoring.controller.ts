import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { MonitoringService } from '../server/server.service.js';
import { ServerStatsService } from '../server/server-stats.service.js';
import type { PeriodeMonitoring } from '../server/server-stats.service.js';
import { RouterMonitoringService } from './router-monitoring.service.js';
import { RadiusMonitoringService } from '../radius/radius-monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RouterMonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly serverStats: ServerStatsService,
    private readonly routerMonitoring: RouterMonitoringService,
    private readonly radiusMonitoring: RadiusMonitoringService,
  ) {}

  @Get('router/options')
  routerOptions() {
    return this.routerMonitoring.options();
  }

  @Get('router/:nasId/realtime')
  routerRealtime(@Param('nasId', ParseIntPipe) nasId: number) {
    return this.routerMonitoring.realtimeSnapshot(nasId);
  }

  @Get('router/:nasId/stats')
  routerStatistics(
    @Param('nasId', ParseIntPipe) nasId: number,
    @Query('periode') periode?: PeriodeMonitoring,
  ) {
    return this.routerMonitoring.getStats(nasId, periode || 'hari_ini');
  }

  @Get('router/:nasId/logs')
  routerLogs(@Param('nasId', ParseIntPipe) nasId: number) {
    return this.routerMonitoring.logs(nasId);
  }
}

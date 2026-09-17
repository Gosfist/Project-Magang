import { Controller, Get, Param, ParseIntPipe, Query, Sse, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MonitoringService } from './monitoring.service.js';
import { ServerStatsService } from './server-stats.service.js';
import { RouterMonitoringService } from './router-monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly serverStats: ServerStatsService,
    private readonly routerMonitoring: RouterMonitoringService,
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
  serverStatistics(@Query('period') period?: 'daily' | 'monthly' | 'yearly') {
    return this.serverStats.getStats(period || 'daily');
  }

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
    @Query('period') period?: 'daily' | 'monthly' | 'yearly',
  ) {
    return this.routerMonitoring.getStats(nasId, period || 'daily');
  }

  @Get('router/:nasId/logs')
  routerLogs(@Param('nasId', ParseIntPipe) nasId: number) {
    return this.routerMonitoring.logs(nasId);
  }
}

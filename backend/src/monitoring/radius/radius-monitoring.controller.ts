import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { RadiusMonitoringService } from './radius-monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RadiusMonitoringController {
  constructor(
    private readonly radiusMonitoring: RadiusMonitoringService,
  ) {}

  @Get('radius/logs')
  radiusLogs(@Query('search') search = '', @Query('reply') reply = '', @Query('page') page = '1') {
    return this.radiusMonitoring.logs(search, reply, Number(page));
  }
}

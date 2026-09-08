import { Controller, Get, Query, Sse, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MonitoringService } from './monitoring.service.js';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}
  @Sse('server/stream')
  @Header('X-Accel-Buffering', 'no')
  stream() { return this.monitoring.stream; }
  @Get('activities')
  activities(@Query('search') search = '', @Query('module') module = '', @Query('page') page = '1') { return this.monitoring.activities(search, module, Number(page)); }
  @Get('server') server() { return this.monitoring.snapshot(); }
}

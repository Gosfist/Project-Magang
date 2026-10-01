import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { MainCoreService } from '../shared/main-core.service.js';

@Controller('main-core/trace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class TraceJalurController {
  constructor(private readonly mainCore: MainCoreService) {}

  @Get()
  trace(@Query('category') category: string, @Query('nodeId') nodeId: string) {
    return this.mainCore.trace(category, nodeId);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { MainCoreService } from './main-core.service.js';

@Controller('main-core')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class MainCoreController {
  constructor(private readonly mainCore: MainCoreService) { }

  @Get('options') options() { return this.mainCore.allOptions(); }
}

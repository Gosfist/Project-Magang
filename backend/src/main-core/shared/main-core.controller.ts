import { MainCoreOutputService } from './main-core-output.service.js';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { MainCoreService } from './main-core.service.js';

@Controller('main-core')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class MainCoreController {
  constructor(private readonly mainCore: MainCoreService, private readonly output: MainCoreOutputService) { }

  @Get(':type/:id/output')
  outputs(@Param('type') type: string, @Param('id') id: string) { return this.output.list(type, id); }

  @Get('options') options() { return this.mainCore.allOptions(); }
}

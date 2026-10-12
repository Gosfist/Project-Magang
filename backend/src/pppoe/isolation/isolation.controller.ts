import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { IsolationService } from './isolation.service.js';
import { SaveIsolationDto } from './isolation.dto.js';

@Controller('pppoe/isolation/:routerId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class IsolationController {
  constructor(private readonly isolation: IsolationService) {}
  @Get() get(@Param('routerId', ParseIntPipe) id: number) { return this.isolation.get(id); }
  @Get('status') status(@Param('routerId', ParseIntPipe) id: number) { return this.isolation.status(id); }
  @Post() save(@Param('routerId', ParseIntPipe) id: number, @Body() dto: SaveIsolationDto) { return this.isolation.save(id, dto); }
  @Post('sync') sync(@Param('routerId', ParseIntPipe) id: number) { return this.isolation.sync(id); }
}

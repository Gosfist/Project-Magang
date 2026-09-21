import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AreaService } from './area.service.js';
import { AssignCollectorDto, SaveAreaDto } from './area.dto.js';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance', 'sales', 'kolektor', 'teknisi')
export class AreaController {
  constructor(private readonly areas: AreaService) {}

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.areas.list(search.trim(), Math.max(1, page), 10, req.user);
  }

  @Get('options')
  options() {
    return this.areas.options();
  }

  @Get('collector-options')
  collectorOptions() {
    return this.areas.collectorOptions();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: SaveAreaDto) {
    return this.areas.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: SaveAreaDto) {
    return this.areas.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.areas.remove(id);
  }

  @Post(':id/collectors')
  @Roles('admin')
  assignCollector(@Param('id') id: string, @Body() dto: AssignCollectorDto) {
    return this.areas.assignCollector(id, dto);
  }

  @Delete(':id/collectors/:userId')
  @Roles('admin')
  removeCollector(@Param('id') id: string, @Param('userId') userId: string) {
    return this.areas.removeCollector(id, userId);
  }

  @Get(':id/customers')
  customers(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('search') search = '',
    @Query('status') status = 'ALL',
  ) {
    return this.areas.getAreaCustomers(id, search.trim(), status, req.user);
  }
}

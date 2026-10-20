import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { RoutersService } from './routers.service.js';
import { SaveRouterDto } from './routers.dto.js';

@Controller('router')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RoutersController {
  constructor(private readonly routerService: RoutersService) {}

  // ==========================================
  // 1. ROUTER / NAS
  // ==========================================

  @Get('nas/options')
  routerOptions() {
    return this.routerService.routerOptions();
  }

  @Get('nas')
  @Header('Cache-Control', 'private, no-store')
  routers(
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.routerService.routers(search.trim(), Math.max(1, page));
  }

  @Post('nas')
  @Header('Cache-Control', 'private, no-store')
  createRouter(@Body() dto: SaveRouterDto) {
    return this.routerService.createRouter(dto);
  }

  @Patch('nas/:id')
  @Header('Cache-Control', 'private, no-store')
  updateRouter(@Param('id') id: string, @Body() dto: SaveRouterDto) {
    return this.routerService.updateRouter(id, dto);
  }

  @Delete('nas/:id')
  removeRouter(@Param('id') id: string) {
    return this.routerService.removeRouter(id);
  }

  @Get('nas/:id/script')
  @Header('Cache-Control', 'private, no-store')
  getRouterScript(@Param('id') id: string) {
    return this.routerService.getRouterScript(id);
  }

}

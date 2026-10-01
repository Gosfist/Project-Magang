import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { SaveMainCoreDto } from '../shared/main-core.dto.js';
import { MainCoreService } from '../shared/main-core.service.js';

@Controller('main-core/server')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class ServerController {
  constructor(private readonly mainCore: MainCoreService) {}

  @Get('parents')
  parents(@Query('search') search = '', @Query('currentNodeId') nodeId?: string, @Query('currentParentId') parentId?: string, @Query('category') category = '') {
    return this.mainCore.parents('server', search, nodeId, parentId, category);
  }

  @Get()
  list(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) {
    return this.mainCore.list('server', search.trim(), Math.max(1, page));
  }

  @Post()
  create(@Body() dto: SaveMainCoreDto) { return this.mainCore.create('server', dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SaveMainCoreDto) { return this.mainCore.update('server', id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.mainCore.remove('server', id); }
}

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { SaveMainCoreDto } from './main-core.dto.js';
import { MainCoreService } from './main-core.service.js';

@Controller('main-core')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class MainCoreController {
  constructor(private readonly mainCore: MainCoreService) { }

  @Get('options') options() { return this.mainCore.allOptions(); }
  @Get('trace') trace(@Query('category') category: string, @Query('nodeId') nodeId: string) { return this.mainCore.trace(category, nodeId); }
  @Get(':type/parents') parents(@Param('type') type: string, @Query('search') search = '', @Query('currentNodeId') nodeId?: string, @Query('currentParentId') parentId?: string, @Query('category') category = '') {
    return this.mainCore.parents(type, search, nodeId, parentId, category);
  }
  @Get(':type') list(@Param('type') type: string, @Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) {
    return this.mainCore.list(type, search.trim(), Math.max(1, page));
  }
  @Post(':type') create(@Param('type') type: string, @Body() dto: SaveMainCoreDto) { return this.mainCore.create(type, dto); }
  @Patch(':type/:id') update(@Param('type') type: string, @Param('id') id: string, @Body() dto: SaveMainCoreDto) { return this.mainCore.update(type, id, dto); }
  @Delete(':type/:id') remove(@Param('type') type: string, @Param('id') id: string) { return this.mainCore.remove(type, id); }
}

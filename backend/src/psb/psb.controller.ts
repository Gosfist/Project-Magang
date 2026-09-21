import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthRequest } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ActivatePsbOrderDto, CreatePsbOrderDto, UpdatePsbOrderDto } from './psb.dto.js';
import { PsbService } from './psb.service.js';

@Controller('psb')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PsbController {
  constructor(private readonly psb: PsbService) {}

  @Get() @Roles('admin', 'sales', 'teknisi')
  list(@Req() req: AuthRequest, @Query('search') search = '', @Query('status') status = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) {
    return this.psb.list(req.user, search.trim(), status, Math.max(1, page));
  }
  @Post() @Roles('admin', 'sales') create(@Body() dto: CreatePsbOrderDto, @Req() req: AuthRequest) { return this.psb.create(dto, req.user.id); }
  @Patch(':id') @Roles('admin', 'sales') update(@Param('id') id: string, @Body() dto: UpdatePsbOrderDto, @Req() req: AuthRequest) { return this.psb.update(id, dto, req.user); }
  @Delete(':id') @Roles('admin', 'sales') remove(@Param('id') id: string, @Req() req: AuthRequest) { return this.psb.remove(id, req.user); }
  @Post(':id/activate') @Roles('admin', 'teknisi') activate(@Param('id') id: string, @Body() dto: ActivatePsbOrderDto, @Req() req: AuthRequest) { return this.psb.activate(id, dto, req.user.id); }
  @Post(':id/complete') @Roles('admin', 'teknisi') complete(@Param('id') id: string, @Req() req: AuthRequest) { return this.psb.complete(id, req.user.id); }
}

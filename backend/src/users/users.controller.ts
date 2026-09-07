import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @Query('search') search = '', @Query('role') role = '', @Query('status') status = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.users.list(search.trim(), role, status, Math.max(1, page));
  }

  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) { return this.users.remove(id, req.user.id); }
}

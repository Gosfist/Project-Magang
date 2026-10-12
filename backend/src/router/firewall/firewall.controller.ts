import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FirewallService } from './firewall.service.js';
import { MoveFirewallRuleDto, SaveFirewallRuleDto } from './firewall.dto.js';

@Controller('router/firewall/:routerId/:family/:table')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FirewallController {
  constructor(private readonly firewall: FirewallService) {}
  @Get() list(@Param('routerId', ParseIntPipe) routerId: number, @Param('family') family: string, @Param('table') table: string) { return this.firewall.list(routerId, family, table); }
  @Post() create(@Param('routerId', ParseIntPipe) routerId: number, @Param('family') family: string, @Param('table') table: string, @Body() dto: SaveFirewallRuleDto) { return this.firewall.create(routerId, family, table, dto.fields); }
  @Patch(':id') update(@Param('routerId', ParseIntPipe) routerId: number, @Param('family') family: string, @Param('table') table: string, @Param('id') id: string, @Body() dto: SaveFirewallRuleDto) { return this.firewall.update(routerId, family, table, id, dto.fields); }
  @Delete(':id') remove(@Param('routerId', ParseIntPipe) routerId: number, @Param('family') family: string, @Param('table') table: string, @Param('id') id: string) { return this.firewall.remove(routerId, family, table, id); }
  @Post(':id/move') move(@Param('routerId', ParseIntPipe) routerId: number, @Param('family') family: string, @Param('table') table: string, @Param('id') id: string, @Body() dto: MoveFirewallRuleDto) { return this.firewall.move(routerId, family, table, id, dto.beforeId); }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthRequest } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { PayrollService } from './payroll.service.js';
import { AttendancePolicyDto, EmployeeLeaveDto, PayrollProfileDto } from './payroll.dto.js';
@Controller('finance/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('finance', 'admin')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() summary(@Query('month') month?: string) { return this.payroll.summary(month); }
  @Post('profiles') profile(@Body() dto: PayrollProfileDto) { return this.payroll.saveProfile(dto); }
  @Get('policy') policy(@Query('month') month?: string) { return this.payroll.policy(month); }
  @Patch('policy') savePolicy(@Query('month') month: string, @Body() dto: AttendancePolicyDto) { return this.payroll.savePolicy(month, dto); }
  @Get('attendance') attendance(@Query('month') month?: string, @Query('date') date?: string, @Query('userId') user?: string) { return this.payroll.attendance(month, date, user); }
  @Post('leaves') leave(@Body() dto: EmployeeLeaveDto, @Req() req: AuthRequest) { return this.payroll.recordLeave(dto, req.user.id); }
  @Delete('leaves/:id') removeLeave(@Param('id') id: string) { return this.payroll.removeLeave(id); }
}
@Controller('employee/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teknisi', 'admin')
export class EmployeeAttendanceController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() today(@Req() req: AuthRequest) { return this.payroll.self(req.user.id); }
  @Post('check-in') checkIn(@Req() req: AuthRequest) { return this.payroll.checkIn(req.user.id); }
  @Post('check-out') checkOut(@Req() req: AuthRequest) { return this.payroll.checkOut(req.user.id); }
  @Get('salary') salary(@Query('month') month: string, @Req() req: AuthRequest) { return this.payroll.summary(month, req.user.id); }
}

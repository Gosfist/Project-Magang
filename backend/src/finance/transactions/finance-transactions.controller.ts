import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FinanceTransactionsService } from './finance-transactions.service.js';
import { CreateTransactionDto, UpdateTransactionDto } from './finance-transactions.dto.js';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance')
export class FinanceTransactionsController {
  constructor(private readonly finance: FinanceTransactionsService) {}

  @Get('transactions')
  list(
    @Query('search') search = '',
    @Query('type') type = '',
    @Query('category') category = '',
    @Query('startDate') startDate = '',
    @Query('endDate') endDate = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.finance.list(search.trim(), type, category, startDate, endDate, Math.max(1, page));
  }

  @Get('categories')
  categories() {
    return this.finance.categories();
  }

  @Post('transactions')
  create(@Body() dto: CreateTransactionDto, @Req() req: AuthRequest) {
    return this.finance.create(dto, req.user.id);
  }

  @Patch('transactions/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.finance.update(id, dto);
  }

  @Delete('transactions/:id')
  remove(@Param('id') id: string) {
    return this.finance.remove(id);
  }
}

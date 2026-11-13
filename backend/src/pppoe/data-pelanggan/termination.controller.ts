import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, type AuthRequest } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { TerminationService } from './termination.service.js';
import {
    CreateTerminationDto,
    CompleteTerminationDto,
    CancelTerminationDto,
} from './termination.dto.js';
@Controller('pppoe/terminations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teknisi')
export class TerminationController {
    constructor(private service: TerminationService) {}
    @Get() list(
        @Query('search') search = '',
        @Query('status') status = 'PENDING',
        @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    ) {
        return this.service.list(search.trim(), status, Math.max(1, page));
    }
    @Get('options') @Roles('admin') options(@Query('search') search = '') {
        return this.service.options(search.trim());
    }
    @Post() @Roles('admin') create(
        @Body() dto: CreateTerminationDto,
        @Req() req: AuthRequest,
    ) {
        return this.service.create(dto, req.user.id);
    }
    @Get(':id/summary') summary(@Param('id') id: string) {
        return this.service.summary(id);
    }
    @Post(':id/complete') complete(
        @Param('id') id: string,
        @Body() dto: CompleteTerminationDto,
        @Req() req: AuthRequest,
    ) {
        return this.service.complete(id, dto, req.user.id);
    }
    @Post(':id/cancel') @Roles('admin') cancel(
        @Param('id') id: string,
        @Body() dto: CancelTerminationDto,
        @Req() req: AuthRequest,
    ) {
        return this.service.cancel(id, dto, req.user.id);
    }
    @Post(':id/notify-approval') @Roles('admin') notifyApproval(
        @Param('id') id: string,
    ) {
        return this.service.notifyApproval(id);
    }
    @Post(':id/notify') resend(@Param('id') id: string) {
        return this.service.resend(id);
    }
}

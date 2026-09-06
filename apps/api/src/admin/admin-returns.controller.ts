import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ReturnsService } from '../orders/returns.service';
import { AdminReturnsQueryDto } from '../orders/dto/admin-returns-query.dto';
import { ApproveReturnDto } from '../orders/dto/approve-return.dto';
import { RejectReturnDto } from '../orders/dto/reject-return.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Phase 6D-4A — the admin queue/detail/approve/reject surface for return
 * and DOA claims. Deliberately thin: every real decision (audit logging,
 * event emission, the atomic PENDING -> APPROVED/REJECTED transition)
 * lives in ReturnsService itself, matching that service's own existing
 * self-contained convention (createClaim, Phase 6D-3) rather than
 * splitting the logic between this controller and the service.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  list(@Query() query: AdminReturnsQueryDto) {
    return this.returnsService.adminListClaims(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.returnsService.adminGetClaim(id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveReturnDto,
    @Req() req: Request,
  ) {
    return this.returnsService.adminApprove(admin.id, id, dto, req.ip);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectReturnDto,
    @Req() req: Request,
  ) {
    return this.returnsService.adminReject(admin.id, id, dto, req.ip);
  }
}

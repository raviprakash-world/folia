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

  /**
   * Phase 6D-4B — executes the financial resolution for an already-
   * APPROVED claim. Deliberately takes no body at all: resolution type
   * (prepaid refund vs. COD store credit) and the amount are both
   * derived entirely from persisted server-side state
   * (ReturnsService.resolveClaim), never from client input.
   */
  @Post(':id/resolve')
  resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.returnsService.resolveClaim(admin.id, id, req.ip);
  }

  /**
   * Phase 6D-4D — records that the returned item physically arrived back
   * at the warehouse. No body: there is nothing for a client to supply,
   * the timestamp is simply "now."
   */
  @Post(':id/mark-item-received')
  markItemReceived(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.returnsService.markItemReceived(admin.id, id, req.ip);
  }
}

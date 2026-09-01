import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AdminUpdateRoleDto } from './dto/admin-update-role.dto';
import { toPublicUser } from '../users/user.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll() {
    const users = await this.usersService.adminFindAll();
    return users.map(toPublicUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.usersService.adminDeactivate(id);
    await this.auditService.log({
      actorId: admin.id,
      action: 'USER_DEACTIVATE',
      resource: 'user',
      resourceId: id,
      ipAddress: req.ip,
    });
    return { ok: true };
  }

  @Put(':id/role')
  async updateRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateRoleDto,
    @Req() req: Request,
  ) {
    const user = await this.usersService.adminUpdateRole(id, dto.role);
    await this.auditService.log({
      actorId: admin.id,
      action: 'USER_ROLE_UPDATE',
      resource: 'user',
      resourceId: id,
      metadata: { newRole: dto.role },
      ipAddress: req.ip,
    });
    return toPublicUser(user);
  }
}

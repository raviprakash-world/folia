import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProductsService } from '../products/products.service';
import { AuditService } from '../audit/audit.service';
import { AdminProductInputDto } from './dto/admin-product-input.dto';
import {
  toPublicProduct,
  badgeToDb,
  careLevelToDb,
} from '../products/product.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminProductInputDto,
    @Req() req: Request,
  ) {
    const product = await this.productsService.adminCreate({
      ...dto,
      badge: badgeToDb(dto.badge),
      careLevel: careLevelToDb(dto.careLevel),
    });
    await this.auditService.log({
      actorId: admin.id,
      action: 'PRODUCT_CREATE',
      resource: 'product',
      resourceId: product.id,
      metadata: { slug: product.slug, name: product.name },
      ipAddress: req.ip,
    });
    return toPublicProduct(product);
  }

  @Put(':id')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminProductInputDto,
    @Req() req: Request,
  ) {
    const product = await this.productsService.adminUpdate(id, {
      ...dto,
      badge: badgeToDb(dto.badge),
      careLevel: careLevelToDb(dto.careLevel),
    });
    await this.auditService.log({
      actorId: admin.id,
      action: 'PRODUCT_UPDATE',
      resource: 'product',
      resourceId: id,
      metadata: { slug: dto.slug, name: dto.name, price: dto.price },
      ipAddress: req.ip,
    });
    return toPublicProduct(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.productsService.adminSoftDelete(id);
    await this.auditService.log({
      actorId: admin.id,
      action: 'PRODUCT_DELETE',
      resource: 'product',
      resourceId: id,
      ipAddress: req.ip,
    });
    return { ok: true };
  }
}

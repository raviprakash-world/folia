import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Public()
  @Get('availability')
  @ApiOperation({
    summary:
      'Real-time (onHand - reserved) for a product, optionally scoped to one variant.',
  })
  getAvailability(
    @Query('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.inventoryService
      .getAvailability(productId, variantId)
      .then((available) => ({ available }));
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('items/:id/adjust')
  @ApiOperation({
    summary:
      'Receive stock, or record a loss/damage/correction (negative delta).',
  })
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(id, dto.delta);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('items/:id/reserve')
  @ApiOperation({
    summary:
      "Hold stock against a cart/order. Exposed here as a real, working endpoint ahead of Phase 4/5's cart/checkout flow, " +
      'which will be the actual caller in practice — either through this same admin-gated path scoped down, or by calling ' +
      'InventoryService directly server-side, whichever that phase\u2019s design calls for.',
  })
  reserve(@Param('id') id: string, @Body() dto: ReserveStockDto) {
    return this.inventoryService.reserve(
      id,
      dto.quantity,
      dto.referenceType,
      dto.referenceId,
      dto.ttlMinutes,
    );
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('reservations/:id/commit')
  @HttpCode(HttpStatus.OK)
  commitReservation(@Param('id') id: string) {
    return this.inventoryService.commitReservation(id);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('reservations/:id/release')
  @HttpCode(HttpStatus.OK)
  releaseReservation(@Param('id') id: string) {
    return this.inventoryService.releaseReservation(id);
  }
}

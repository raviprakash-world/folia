import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Seller } from '@prisma/client';
import { SellerOrdersService } from './seller-orders.service';
import { RequireSeller } from './decorators/require-seller.decorator';
import { CurrentSeller } from './decorators/current-seller.decorator';
import { SellerOrdersQueryDto } from './dto/seller-orders-query.dto';
import { UpdateSellerOrderNoteDto } from './dto/update-seller-order-note.dto';

/**
 * Marketplace Phase 10 — real visibility into orders containing this
 * seller's own products, and a private fulfillment note. Real per-seller
 * shipment/tracking actions are Marketplace Phase 12's own job — this
 * controller stays read-plus-note only.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers/me/orders')
export class SellerOrdersController {
  constructor(private readonly sellerOrdersService: SellerOrdersService) {}

  @Get()
  @RequireSeller()
  list(@CurrentSeller() seller: Seller, @Query() query: SellerOrdersQueryDto) {
    return this.sellerOrdersService.listForSeller(seller.id, {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':id')
  @RequireSeller()
  detail(@CurrentSeller() seller: Seller, @Param('id') id: string) {
    return this.sellerOrdersService.getOneForSeller(seller.id, id);
  }

  @Patch(':id/note')
  @RequireSeller()
  updateNote(
    @CurrentSeller() seller: Seller,
    @Param('id') id: string,
    @Body() dto: UpdateSellerOrderNoteDto,
  ) {
    return this.sellerOrdersService.updateSellerNote(seller.id, id, dto.note);
  }
}

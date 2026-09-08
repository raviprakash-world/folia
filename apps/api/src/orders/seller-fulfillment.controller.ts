import { Controller, ForbiddenException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Seller } from '@prisma/client';
import { OrdersService } from './orders.service';
import { RequireSeller } from '../sellers/decorators/require-seller.decorator';
import { CurrentSeller } from '../sellers/decorators/current-seller.decorator';

/**
 * Marketplace Phase 12 — the real per-seller fulfillment action
 * SellerOrdersController (Phase 10) deliberately left out, since no
 * shipment mechanism existed yet. Lives in the orders module (not
 * alongside SellerOrdersController in the sellers module) specifically to
 * avoid a circular module dependency: OrdersModule already imports
 * PaymentsModule, which imports SellersModule — importing OrdersModule
 * back into SellersModule would cycle. The route prefix still reads as
 * part of the same seller-facing surface from the client's own
 * perspective; @RequireSeller()/@CurrentSeller() need no module wiring at
 * all (SellerGuard is a global APP_GUARD — see app.module.ts).
 */
@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers/me/orders')
export class SellerFulfillmentController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':id/ship')
  @RequireSeller()
  ship(@CurrentSeller() seller: Seller, @Param('id') id: string) {
    // P0-C-5 — SellerGuard is deliberately status-agnostic (see
    // SellersService.apply's doc comment); this is the enforcement point
    // that stops a SUSPENDED/DEACTIVATED seller from continuing to ship
    // real customer orders after an admin has revoked their standing.
    if (seller.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your seller account must be active to ship orders.',
      );
    }
    return this.ordersService.shipOrderSellerGroup(id, seller.id);
  }
}

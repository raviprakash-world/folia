import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { WishlistService } from '../wishlist/wishlist.service';
import { OrdersService } from '../orders/orders.service';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Same optional-auth pattern as CartController (Phase 4) — @Public() so
 * the global JwtAuthGuard doesn't reject an anonymous search, plus
 * OptionalJwtAuthGuard so a valid token, if sent, still identifies the
 * caller and unlocks real wishlist/purchase-history ranking signals.
 */
@ApiTags('search')
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly wishlistService: WishlistService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ) {
    if (!user) {
      return this.searchService.search(query.q);
    }

    const [wishlist, purchasedProductIds] = await Promise.all([
      this.wishlistService.findAllForUser(user.id),
      this.ordersService.getPurchasedProductIds(user.id),
    ]);

    return this.searchService.search(query.q, {
      wishlistIds: wishlist.map((w) => w.productId),
      purchasedProductIds,
    });
  }

  @Get('trending')
  getTrending() {
    return this.searchService.getTrending();
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { PersonalizedQueryDto } from './dto/personalized-query.dto';
import { WishlistService } from '../wishlist/wishlist.service';
import { OrdersService } from '../orders/orders.service';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../users/user.types';

/** Same optional-auth pattern as CartController (Phase 4) / SearchController (Phase 7) — public, but richer for an authenticated caller. */
@ApiTags('recommendations')
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly wishlistService: WishlistService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('products/:id/similar')
  getSimilar(@Param('id') id: string) {
    return this.recommendationsService.getSimilar(id);
  }

  @Get('products/:id/frequently-bought-together')
  getFrequentlyBoughtTogether(@Param('id') id: string) {
    return this.recommendationsService.getFrequentlyBoughtTogether(id);
  }

  @Get('personalized')
  async getPersonalized(
    @Query() query: PersonalizedQueryDto,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ) {
    const base = {
      recentlyViewedIds: query.recentlyViewedIds ?? [],
      recentSearches: query.recentSearches ?? [],
    };

    if (!user) {
      return this.recommendationsService.getPersonalized({
        ...base,
        wishlistIds: [],
        purchasedProductIds: [],
      });
    }

    const [wishlist, purchasedProductIds] = await Promise.all([
      this.wishlistService.findAllForUser(user.id),
      this.ordersService.getPurchasedProductIds(user.id),
    ]);

    return this.recommendationsService.getPersonalized({
      ...base,
      wishlistIds: wishlist.map((w) => w.productId),
      purchasedProductIds,
    });
  }

  @Get('bestsellers')
  getBestsellers() {
    return this.recommendationsService.getBestsellers();
  }

  @Get('trending')
  getTrending() {
    return this.recommendationsService.getTrending();
  }
}

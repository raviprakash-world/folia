import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireSeller } from './decorators/require-seller.decorator';
import { CurrentSeller } from './decorators/current-seller.decorator';
import { toSellerProfile, type SellerProfile } from './seller.types';
import type { Seller } from '@prisma/client';

/**
 * Marketplace Phase 1 — infrastructure-proving surface only. Seller
 * application (POST) and profile editing are Marketplace Phase 2's job;
 * this phase's one real endpoint exists to prove SellerGuard/
 * @CurrentSeller() actually work end to end against the real database, not
 * as a placeholder.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers')
export class SellersController {
  @Get('me')
  @RequireSeller()
  @ApiOperation({
    summary: "Get the authenticated user's own seller profile.",
  })
  getMyProfile(@CurrentSeller() seller: Seller): SellerProfile {
    return toSellerProfile(seller);
  }
}

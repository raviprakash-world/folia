import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SELLER_KEY = 'requireSeller';

/**
 * Marks a route as seller-scoped — checked by SellerGuard, which resolves
 * the caller's own Seller row from their authenticated user id (never from
 * a client-supplied sellerId anywhere in the request) and attaches it for
 * @CurrentSeller() to read. A route with no @RequireSeller() metadata
 * passes through SellerGuard unrestricted — same "narrows, never grants"
 * shape as @Roles()/RolesGuard.
 */
export const RequireSeller = () => SetMetadata(REQUIRE_SELLER_KEY, true);

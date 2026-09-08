import {
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SELLER_KEY } from '../decorators/require-seller.decorator';
import { SellersService } from '../sellers.service';
import type { AuthenticatedUser } from '../../users/user.types';
import type { Seller } from '@prisma/client';

interface RequestWithSeller {
  user: AuthenticatedUser;
  seller?: Seller;
}

/**
 * Checked after JwtAuthGuard/RolesGuard (which populate request.user) —
 * routes with no @RequireSeller() metadata pass through unrestricted, same
 * "narrows, never grants" pattern as RolesGuard.
 *
 * This is the actual seller-isolation enforcement point: it resolves the
 * caller's OWN Seller row from request.user.id, never from any
 * client-supplied sellerId in the path/body/query — matching the governing
 * brief's explicit rule ("derive the seller identity from the
 * authenticated user/session"). A user with no seller account at all
 * hitting a @RequireSeller() route gets a 404 ("nothing to find"), the
 * same ownership-check convention this codebase already uses everywhere
 * else (see addresses.service.ts's findOwnedOrThrow) — never a
 * distinguishing error that would leak whether a given user has a seller
 * account.
 */
@Injectable()
export class SellerGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly sellersService: SellersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresSeller = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SELLER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresSeller) return true;

    const request = context.switchToHttp().getRequest<RequestWithSeller>();
    const seller = await this.sellersService.findByUserId(request.user.id);
    if (!seller) {
      throw new NotFoundException('Seller profile not found.');
    }
    request.seller = seller;
    return true;
  }
}

import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import type { Seller } from '@prisma/client';

interface RequestWithSeller {
  seller?: Seller;
}

/**
 * Injects the caller's own Seller row — populated by SellerGuard, which
 * MUST run first (pair this with @RequireSeller() on the same route; the
 * guard is what actually derives the identity from the session and 404s a
 * user with no seller account — this decorator only reads what it found).
 * A missing request.seller here means the route forgot @RequireSeller() —
 * a development-time wiring mistake, not a real request shape a client can
 * trigger, hence the 500 rather than a user-facing error.
 */
export const CurrentSeller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Seller => {
    const request = ctx.switchToHttp().getRequest<RequestWithSeller>();
    if (!request.seller) {
      throw new InternalServerErrorException(
        'CurrentSeller used without @RequireSeller() on the route.',
      );
    }
    return request.seller;
  },
);

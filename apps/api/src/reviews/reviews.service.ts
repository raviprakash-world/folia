import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewRecord } from '../products/product.types';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mirrors GET /api/reviews's exact behavior: filtered by productId when given, otherwise all reviews. */
  async findMany(productId?: string): Promise<ReviewRecord[]> {
    return this.prisma.review.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Marketplace Phase 13 — the first real, write-capable review this
   * codebase has ever had; every review before this phase was seed-time
   * display data with no real account or purchase behind it. `verified`
   * is not a display flag chosen by the caller — it's what this method's
   * own eligibility gate below already proves true for every review it
   * creates, so it's hardcoded true here, never accepted as input.
   *
   * Real verified-purchase gate: at least one of this user's own
   * DELIVERED orders must contain this exact product — the same
   * ownership-scoped-in-the-query pattern this whole codebase already
   * uses everywhere else, just checking existence rather than fetching a
   * specific row. Real duplicate-review guard: reviews_productId_userId_key
   * (the schema's own @@unique constraint) is the atomic, race-proof gate
   * — caught here as a clean 409, matching this codebase's established
   * P2002-to-clean-error idiom, not a pre-flight SELECT that a concurrent
   * second request could still race past.
   *
   * Product.rating/reviewCount were pure seed-time values before this
   * phase — never recomputed by anything, since nothing could ever create
   * a new review. Recomputed here, in the same transaction as the review
   * itself, mirroring InventoryService.syncProductCache's own
   * recompute-from-source-of-truth-and-write-back shape.
   */
  async createReview(
    userId: string,
    author: string,
    input: { productId: string; rating: number; title: string; body: string },
  ): Promise<ReviewRecord> {
    const hasDeliveredPurchase = await this.prisma.orderItem.findFirst({
      where: {
        productId: input.productId,
        order: { userId, status: 'DELIVERED' },
      },
      select: { id: true },
    });
    if (!hasDeliveredPurchase) {
      throw new BadRequestException(
        'You can only review a product from a delivered order.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            productId: input.productId,
            userId,
            author,
            rating: input.rating,
            title: input.title,
            body: input.body,
            date: new Date(),
            verified: true,
          },
        });

        const agg = await tx.review.aggregate({
          where: { productId: input.productId },
          _avg: { rating: true },
          _count: true,
        });
        await tx.product.update({
          where: { id: input.productId },
          data: {
            rating: agg._avg.rating ?? 0,
            reviewCount: agg._count,
          },
        });

        return review;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product.');
      }
      throw err;
    }
  }
}

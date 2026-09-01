/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable } from '@nestjs/common';
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
    }) as Promise<ReviewRecord[]>;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { WishlistItemRecord } from './wishlist.types';

const WISHLIST_INCLUDE = { product: { include: { category: true } } } as const;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<WishlistItemRecord[]> {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: WISHLIST_INCLUDE,
      orderBy: { addedAt: 'desc' },
    }) as Promise<WishlistItemRecord[]>;
  }

  /** Idempotent — adding a product that's already wishlisted is a no-op success, not an error (matches how the frontend's own toggle-based UI expects to call this without checking first). */
  async add(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }
}

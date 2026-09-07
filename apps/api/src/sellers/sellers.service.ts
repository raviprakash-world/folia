import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Seller } from '@prisma/client';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Never accepts a sellerId from a caller — always looked up by the
   * authenticated user's own id. This is the one method SellerGuard calls
   * to derive seller identity server-side; every other seller-scoped
   * service this initiative adds should resolve identity the same way,
   * never by trusting an id supplied in a request.
   */
  async findByUserId(userId: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { userId } });
  }
}

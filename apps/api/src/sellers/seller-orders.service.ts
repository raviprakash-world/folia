import { Injectable, NotFoundException } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  toPublicSellerOrderGroup,
  type PublicSellerOrderGroup,
} from './seller-order.types';

const GROUP_INCLUDE = {
  items: true,
  order: {
    select: { deliveryMethod: true, shippingAddressSnapshot: true },
  },
} as const;

/**
 * Marketplace Phase 10 — the seller-facing order visibility surface. Every
 * query is scoped by `sellerId` inline in the WHERE clause, exactly like
 * this whole initiative's every other ownership check (see
 * docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §10) — a group
 * belonging to a different seller 404s here identically to a nonexistent
 * one, never a distinguishing 403. Deliberately narrow: this reads
 * OrderSellerGroup/OrderItem (real per-seller rows, already correctly
 * scoped since Phase 5), and writes only the private sellerNote — it does
 * NOT transition OrderSellerGroup.status, which stays reserved for
 * Marketplace Phase 12's real per-seller shipment action.
 */
@Injectable()
export class SellerOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForSeller(
    sellerId: string,
    filter: { status?: OrderStatus; page: number; pageSize: number },
  ): Promise<{ items: PublicSellerOrderGroup[]; total: number }> {
    const where = { sellerId, status: filter.status };
    const [groups, total] = await Promise.all([
      this.prisma.orderSellerGroup.findMany({
        where,
        include: GROUP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.orderSellerGroup.count({ where }),
    ]);
    return { items: groups.map(toPublicSellerOrderGroup), total };
  }

  async getOneForSeller(
    sellerId: string,
    groupId: string,
  ): Promise<PublicSellerOrderGroup> {
    const group = await this.prisma.orderSellerGroup.findFirst({
      where: { id: groupId, sellerId },
      include: GROUP_INCLUDE,
    });
    if (!group) throw new NotFoundException('Order not found.');
    return toPublicSellerOrderGroup(group);
  }

  async updateSellerNote(
    sellerId: string,
    groupId: string,
    note: string,
  ): Promise<PublicSellerOrderGroup> {
    const { count } = await this.prisma.orderSellerGroup.updateMany({
      where: { id: groupId, sellerId },
      data: { sellerNote: note || null },
    });
    if (count === 0) throw new NotFoundException('Order not found.');
    return this.getOneForSeller(sellerId, groupId);
  }
}

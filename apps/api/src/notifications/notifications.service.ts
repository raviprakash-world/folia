/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NotificationRecord,
  NotificationType,
} from './notification.types';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The one method every real event listener (Phase 15F) calls —
   * deliberately the sole write path for creating a notification, so
   * business events never touch the controller layer directly, matching
   * this codebase's existing "controllers stay thin" convention.
   */
  async create(input: CreateNotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        href: input.href ?? null,
      },
    });
  }

  async findAllForUser(
    userId: string,
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    const clampedPageSize = Math.min(pageSize, PAGE_SIZE_MAX);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * clampedPageSize,
        take: clampedPageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items: items as NotificationRecord[], total };
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  /**
   * Throws NotFoundException — not a silent no-op — when id doesn't
   * belong to this user. This deliberately diverges from
   * wishlist.service.ts's silent deleteMany precedent: that domain has
   * no stated requirement to distinguish "not yours" as an error, but
   * this one's own spec explicitly requires testing that cross-user
   * access is rejected (Phase 15M/15O), so a 200-with-zero-rows-changed
   * wouldn't actually satisfy it. updateMany/deleteMany with a plain
   * {id, userId} where clause is safe and correct for this scoping —
   * unlike findUnique with a compound-key nullable-field lookup, the
   * real limitation documented in addresses.service.ts, which doesn't
   * apply here since these accept any ordinary where filter, not just a
   * unique-index match. Doesn't distinguish "belongs to someone else"
   * from "doesn't exist" in the response, matching the same
   * non-disclosure reasoning as auth's login error messages.
   */
  async markAsRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (count === 0) throw new NotFoundException('Notification not found.');
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  /** Same reasoning as markAsRead above — a real 404 on cross-user access, not a silent no-op. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Notification not found.');
  }
}

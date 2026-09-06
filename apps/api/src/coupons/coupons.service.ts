/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicCoupon } from './coupons.types';
import type { CouponRecord } from './coupons.types';

/**
 * Mirrors apps/web/src/services/couponService.ts's validateCoupon()
 * exactly — same normalization (trim + uppercase), same minSubtotal
 * check, same error message format (down to the exact wording and
 * decimal formatting) — read directly from that file before writing this,
 * not approximated. The frontend's version trusts the client with the
 * coupon's discount value once "validated"; this real backend version is
 * what makes that trust actually safe, since the client can no longer
 * fabricate a coupon result.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, subtotal: number) {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalized },
    });

    if (!coupon || !(coupon as CouponRecord).isActive) {
      throw new BadRequestException("That code isn't valid.");
    }

    const typedCoupon = coupon as CouponRecord;
    if (typedCoupon.expiresAt && typedCoupon.expiresAt < new Date()) {
      throw new BadRequestException("That code isn't valid.");
    }

    const minSubtotal = typedCoupon.minSubtotal?.toNumber();
    if (minSubtotal && subtotal < minSubtotal) {
      const remainder = (minSubtotal - subtotal).toFixed(2);
      throw new BadRequestException(
        `This code needs a ₹${minSubtotal} subtotal — add ₹${remainder} more.`,
      );
    }

    return toPublicCoupon(typedCoupon);
  }
}

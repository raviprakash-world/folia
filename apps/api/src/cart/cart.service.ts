// See users/users.service.ts's top-of-file comment for why this exemption exists.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { generateSecureToken } from '../auth/token.util';
import type { CartRecord } from './cart.types';

const CART_INCLUDE = {
  items: {
    include: {
      // Marketplace Phase 16 — displayName only, so the cart can label
      // which seller each line ships from (customer-facing; the
      // Folia-owned sellerId: null case already omits this at the
      // toPublicCartItem mapping layer).
      product: {
        include: { category: true, seller: { select: { displayName: true } } },
      },
      variant: true,
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * The one entry point every cart endpoint goes through. Three cases:
   * 1. Authenticated, no guest cookie: return/create their user cart.
   * 2. Authenticated AND a guest cookie is present: merge the guest cart
   *    into the user cart (real quantities combined, capped at actual
   *    available stock), delete the guest cart, signal the caller to
   *    clear the cookie.
   * 3. Anonymous: return/create a cart keyed by the guest token, minting
   *    a new one if none was presented.
   */
  async resolveCart(
    userId: string | null,
    guestToken: string | null,
  ): Promise<{
    cart: CartRecord;
    newGuestToken?: string;
    clearGuestCookie?: boolean;
  }> {
    if (userId) {
      let userCart = await this.prisma.cart.findUnique({
        where: { userId },
        include: CART_INCLUDE,
      });
      if (!userCart) {
        userCart = await this.prisma.cart.create({
          data: { userId },
          include: CART_INCLUDE,
        });
      }

      if (guestToken) {
        const merged = await this.mergeGuestCartIntoUserCart(
          guestToken,
          userCart.id,
        );
        if (merged) {
          const refreshed = await this.prisma.cart.findUniqueOrThrow({
            where: { id: userCart.id },
            include: CART_INCLUDE,
          });
          return { cart: refreshed, clearGuestCookie: true };
        }
      }
      return { cart: userCart, clearGuestCookie: !!guestToken };
    }

    if (guestToken) {
      const existing = await this.prisma.cart.findUnique({
        where: { guestToken },
        include: CART_INCLUDE,
      });
      if (existing) return { cart: existing };
    }

    const newToken = generateSecureToken().raw;
    const created = await this.prisma.cart.create({
      data: { guestToken: newToken },
      include: CART_INCLUDE,
    });
    return { cart: created, newGuestToken: newToken };
  }

  /** Returns true if a guest cart actually existed and was merged; false if there was nothing to merge (no error either way — a missing/expired guest cookie is a normal, common case). */
  private async mergeGuestCartIntoUserCart(
    guestToken: string,
    userCartId: string,
  ): Promise<boolean> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestToken },
      include: CART_INCLUDE,
    });
    if (!guestCart || guestCart.items.length === 0) {
      if (guestCart)
        await this.prisma.cart.delete({ where: { id: guestCart.id } });
      return !!guestCart;
    }

    for (const guestItem of guestCart.items as {
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: unknown;
    }[]) {
      const existingUserItem = await this.prisma.cartItem.findFirst({
        where: {
          cartId: userCartId,
          productId: guestItem.productId,
          variantId: guestItem.variantId,
        },
      });

      const available = await this.inventoryService.getAvailability(
        guestItem.productId,
        guestItem.variantId ?? undefined,
      );
      const combinedQuantity = Math.min(
        (existingUserItem?.quantity ?? 0) + guestItem.quantity,
        Math.max(available, existingUserItem?.quantity ?? 0), // never shrink an existing line below what the user already had
      );

      if (existingUserItem) {
        await this.prisma.cartItem.update({
          where: { id: existingUserItem.id },
          data: { quantity: combinedQuantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: userCartId,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
            quantity: combinedQuantity,
            unitPrice: guestItem.unitPrice as never,
          },
        });
      }
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } }); // cascades to its items
    return true;
  }

  /**
   * unitPrice is deliberately NOT a caller-supplied parameter — it's
   * looked up from the real Product record here, inside the service.
   * Accepting a client-supplied price would let anyone add items to
   * their cart at whatever price they chose to send; the snapshot-at-
   * add-time semantic (apps/web/src/types/cart.ts's CartItem doc
   * comment) is about not retroactively repricing existing cart lines
   * when the catalog price changes later, not about trusting the client
   * for the price in the first place.
   */
  async addItem(
    cartId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<CartRecord> {
    if (quantity <= 0)
      throw new BadRequestException('Quantity must be positive.');

    // Marketplace Phase 3/5 — a real gap closed here: this lookup never
    // filtered by approvalStatus, so a seller's own DRAFT/SUBMITTED/
    // ARCHIVED/REJECTED product could be added to a cart at all (nothing
    // about "not deletedAt" implies "approved"). Matches the same filter
    // ProductsService's every customer-facing read already applies.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, approvalStatus: 'ACTIVE' },
    });
    if (!product) throw new NotFoundException('Product not found');
    const unitPrice = (
      product as { price: { toNumber(): number } }
    ).price.toNumber();

    const available = await this.inventoryService.getAvailability(
      productId,
      variantId ?? undefined,
    );
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
    });

    const desiredQuantity = (existing?.quantity ?? 0) + quantity;
    if (desiredQuantity > available) {
      throw new BadRequestException(`Only ${available} unit(s) available.`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desiredQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, productId, variantId, quantity, unitPrice },
      });
    }

    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  async updateItemQuantity(
    cartId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<CartRecord> {
    if (quantity <= 0)
      throw new BadRequestException(
        'Quantity must be positive — use removeItem to remove a line entirely.',
      );

    const item = await this.prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
    });
    if (!item) throw new NotFoundException('That item is not in this cart.');

    const available = await this.inventoryService.getAvailability(
      productId,
      variantId ?? undefined,
    );
    if (quantity > available)
      throw new BadRequestException(`Only ${available} unit(s) available.`);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  async removeItem(
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<CartRecord> {
    await this.prisma.cartItem.deleteMany({
      where: { cartId, productId, variantId },
    });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  async clearCart(cartId: string): Promise<CartRecord> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }
}

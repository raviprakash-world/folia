import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { toPublicCart } from './cart.types';
import {
  GUEST_CART_COOKIE_MAX_AGE_DAYS,
  GUEST_CART_COOKIE_NAME,
} from './cart.constants';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AppConfigService } from '../config/app-config.service';
import type { AuthenticatedUser } from '../users/user.types';
import type { CartRecord } from './cart.types';

/**
 * Every endpoint here is @Public() (so the global JwtAuthGuard doesn't
 * reject an anonymous request) PLUS OptionalJwtAuthGuard (so a valid
 * Bearer token, if one IS sent, still populates the user) — see
 * optional-jwt-auth.guard.ts's doc comment for why both pieces are
 * needed together, not either alone.
 */
@ApiTags('cart')
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly config: AppConfigService,
  ) {}

  private async resolveCartWithCookies(
    user: AuthenticatedUser | undefined,
    req: Request,
    res: Response,
  ): Promise<CartRecord> {
    const guestToken =
      (req.cookies as Record<string, string> | undefined)?.[
        GUEST_CART_COOKIE_NAME
      ] ?? null;
    const { cart, newGuestToken, clearGuestCookie } =
      await this.cartService.resolveCart(user?.id ?? null, guestToken);

    if (newGuestToken) {
      res.cookie(GUEST_CART_COOKIE_NAME, newGuestToken, {
        httpOnly: true,
        secure: this.config.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: GUEST_CART_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      });
    }
    if (clearGuestCookie) {
      res.clearCookie(GUEST_CART_COOKIE_NAME, { path: '/' });
    }
    return cart;
  }

  @Get()
  async getCart(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.resolveCartWithCookies(user, req, res);
    return toPublicCart(cart);
  }

  @Post('items')
  async addItem(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
  ) {
    const cart = await this.resolveCartWithCookies(user, req, res);
    const updated = await this.cartService.addItem(
      cart.id,
      dto.productId,
      dto.variantId ?? null,
      dto.quantity,
    );
    return toPublicCart(updated);
  }

  @Put('items/:productId')
  async updateItem(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const cart = await this.resolveCartWithCookies(user, req, res);
    const updated = await this.cartService.updateItemQuantity(
      cart.id,
      productId,
      dto.variantId ?? null,
      dto.quantity,
    );
    return toPublicCart(updated);
  }

  @Delete('items/:productId')
  async removeItem(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    const cart = await this.resolveCartWithCookies(user, req, res);
    const updated = await this.cartService.removeItem(
      cart.id,
      productId,
      variantId ?? null,
    );
    return toPublicCart(updated);
  }

  @Delete()
  async clearCart(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.resolveCartWithCookies(user, req, res);
    const cleared = await this.cartService.clearCart(cart.id);
    return toPublicCart(cleared);
  }
}

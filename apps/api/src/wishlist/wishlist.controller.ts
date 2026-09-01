import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { toPublicWishlistItem } from './wishlist.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.wishlistService.findAllForUser(user.id);
    return items.map(toPublicWishlistItem);
  }

  @Post(':productId')
  @HttpCode(HttpStatus.OK)
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<{ ok: true }> {
    await this.wishlistService.add(user.id, productId);
    return { ok: true };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<{ ok: true }> {
    await this.wishlistService.remove(user.id, productId);
    return { ok: true };
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { toPublicReview } from '../products/product.types';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Marketplace Phase 13 — @Public() now lives on this one method, not
  // the whole class, so the new POST route below correctly requires
  // authentication via the global JwtAuthGuard's normal default.
  @Get()
  @Public()
  async findMany(@Query('productId') productId?: string) {
    const reviews = await this.reviewsService.findMany(productId);
    return reviews.map(toPublicReview);
  }

  @Post()
  @ApiBearerAuth()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    const author = `${user.firstName} ${user.lastName.charAt(0)}.`;
    const review = await this.reviewsService.createReview(user.id, author, {
      productId: dto.productId,
      rating: dto.rating,
      title: dto.title,
      body: dto.body,
    });
    return toPublicReview(review);
  }
}

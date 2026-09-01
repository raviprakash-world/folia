import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { toPublicReview } from '../products/product.types';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('reviews')
@Public()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async findMany(@Query('productId') productId?: string) {
    const reviews = await this.reviewsService.findMany(productId);
    return reviews.map(toPublicReview);
  }
}

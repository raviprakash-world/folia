import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const ADMIN_SELLER_PRODUCTS_STATUS_FILTERS = [
  'all',
  'submitted',
  'under-review',
  'rejected',
  'active',
  'archived',
] as const;

/** Matches AdminSellersQueryDto's page/pageSize/status-filter convention exactly. */
export class AdminSellerProductsQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_SELLER_PRODUCTS_STATUS_FILTERS,
    default: 'submitted',
    description:
      'Defaults to the moderation queue (submitted + under review). Pass "all" or another status to review the full seller-product list.',
  })
  @IsOptional()
  @IsIn(ADMIN_SELLER_PRODUCTS_STATUS_FILTERS)
  status: (typeof ADMIN_SELLER_PRODUCTS_STATUS_FILTERS)[number] = 'submitted';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

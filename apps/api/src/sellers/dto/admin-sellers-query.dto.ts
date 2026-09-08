import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const ADMIN_SELLERS_STATUS_FILTERS = [
  'all',
  'applied',
  'under-review',
  'rejected',
  'active',
  'suspended',
  'deactivated',
] as const;

/** Matches AdminReturnsQueryDto's page/pageSize/status-filter convention exactly. */
export class AdminSellersQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_SELLERS_STATUS_FILTERS,
    default: 'applied',
    description:
      'Defaults to the applied queue. Pass "all" or another status to review the full seller list.',
  })
  @IsOptional()
  @IsIn(ADMIN_SELLERS_STATUS_FILTERS)
  status: (typeof ADMIN_SELLERS_STATUS_FILTERS)[number] = 'applied';

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

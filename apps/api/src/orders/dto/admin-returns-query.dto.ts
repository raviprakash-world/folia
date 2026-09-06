import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const ADMIN_RETURNS_STATUS_FILTERS = [
  'pending',
  'approved',
  'rejected',
  'refund-issued',
  'store-credit-issued',
  'replacement-issued',
] as const;

/** Matches NotificationsQueryDto's page/pageSize convention exactly. */
export class AdminReturnsQueryDto {
  @ApiPropertyOptional({
    enum: ADMIN_RETURNS_STATUS_FILTERS,
    default: 'pending',
    description:
      'Defaults to the pending queue. Pass another status to review already-decided claims.',
  })
  @IsOptional()
  @IsIn(ADMIN_RETURNS_STATUS_FILTERS)
  status: (typeof ADMIN_RETURNS_STATUS_FILTERS)[number] = 'pending';

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

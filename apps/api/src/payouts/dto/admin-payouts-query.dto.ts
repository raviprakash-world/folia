import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PAYOUT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
] as const;

export class AdminPayoutsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional({ enum: PAYOUT_STATUSES })
  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  status?: (typeof PAYOUT_STATUSES)[number];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CANCELLATION_REASONS = [
  'changed-mind',
  'found-cheaper',
  'ordered-by-mistake',
  'shipping-too-slow',
  'other',
] as const;

export class CancelOrderDto {
  @ApiProperty({ enum: CANCELLATION_REASONS })
  @IsIn(CANCELLATION_REASONS)
  reason!: (typeof CANCELLATION_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

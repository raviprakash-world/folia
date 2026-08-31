import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const RETURN_REASONS = [
  'no-longer-needed',
  'wrong-item',
  'damaged-in-transit',
  'not-as-described',
  'changed-mind',
  'other',
] as const;

export class ReturnOrderDto {
  @ApiProperty({ enum: RETURN_REASONS })
  @IsIn(RETURN_REASONS)
  reason!: (typeof RETURN_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

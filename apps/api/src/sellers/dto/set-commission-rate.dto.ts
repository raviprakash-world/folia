import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetCommissionRateDto {
  @ApiPropertyOptional({
    description:
      'Omit (or send null) to set the marketplace-default rate. Set to a specific seller id to create an override for just that seller.',
  })
  @IsOptional()
  @IsString()
  sellerId?: string | null;

  @ApiProperty({ description: 'Commission percentage, 0–100.' })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;
}

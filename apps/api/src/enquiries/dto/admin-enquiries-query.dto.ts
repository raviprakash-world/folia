import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ENQUIRY_TYPES } from './create-enquiry.dto';

export const ENQUIRY_STATUS_FILTERS = ['NEW', 'HANDLED'] as const;

export class AdminEnquiriesQueryDto {
  @ApiPropertyOptional({ enum: ENQUIRY_STATUS_FILTERS, default: 'NEW' })
  @IsOptional()
  @IsIn(ENQUIRY_STATUS_FILTERS)
  status: (typeof ENQUIRY_STATUS_FILTERS)[number] = 'NEW';

  @ApiPropertyOptional({ enum: ENQUIRY_TYPES })
  @IsOptional()
  @IsIn(ENQUIRY_TYPES)
  type?: (typeof ENQUIRY_TYPES)[number];

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

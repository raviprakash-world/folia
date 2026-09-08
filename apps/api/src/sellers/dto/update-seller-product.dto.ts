import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

const CARE_LEVELS = ['Easy', 'Moderate', 'Advanced'] as const;

/**
 * Every field optional — a partial update, not a full re-submission.
 * Only usable while the product is DRAFT or REJECTED (editing while
 * REJECTED re-enters DRAFT, clearing the rejection note — mirrors the
 * lifecycle diagram's own literal "REJECTED -> DRAFT" arrow, and the
 * identical pattern already established for UpdateSellerDto/Seller in
 * Marketplace Phase 2). `stock`, when provided, is an ABSOLUTE new
 * quantity — SellerProductsService computes the delta and applies it via
 * InventoryService.adjustStock, never writing Product.stockCount
 * directly.
 */
export class UpdateSellerProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Must be greater than 0.' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: CARE_LEVELS })
  @IsOptional()
  @IsIn(CARE_LEVELS)
  careLevel?: (typeof CARE_LEVELS)[number];

  @ApiPropertyOptional({
    minimum: 0,
    description: 'New absolute stock quantity.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}

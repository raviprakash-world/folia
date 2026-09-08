import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * Deliberately excludes fields the governing brief marks admin-only or
 * derived: `slug` (auto-generated server-side, same reasoning as
 * Seller.slug — never trust a client-supplied unique identifier), `badge`
 * (a marketplace merchandising decision — "Bestseller"/"Sale" are not a
 * seller's own call to make about their own listing), `sellerId`/
 * `ownerType`/`approvalStatus` (derived from session/lifecycle, never
 * client input), and `stockCount`/`inStock` (InventoryService's exclusive
 * derived-cache domain — matching AdminProductInputDto's own identical
 * exclusion and reasoning exactly). `initialStock` here is a real
 * quantity that creates/adjusts a real InventoryItem row, not a
 * catalog-only number.
 */
export class SellerProductInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Must be greater than 0.' })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  description!: string;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ enum: CARE_LEVELS })
  @IsOptional()
  @IsIn(CARE_LEVELS)
  careLevel?: (typeof CARE_LEVELS)[number];

  @ApiProperty({ minimum: 0, description: 'Initial stock quantity on hand.' })
  @IsInt()
  @Min(0)
  initialStock!: number;
}

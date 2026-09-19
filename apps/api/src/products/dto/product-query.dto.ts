import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SORT_KEYS = [
  'featured',
  'price-asc',
  'price-desc',
  'newest',
  'rating',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Mirrors apps/web/src/types/product.ts's ProductQuery exactly — same param names, same optionality. */
export class ProductQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Curated collection slug (e.g. pet-friendly).',
  })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional({ enum: SORT_KEYS })
  @IsOptional()
  @IsIn(SORT_KEYS)
  sort?: SortKey;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      "Marketplace Phase 4 — filter to one seller's storefront. Never combined with a Folia-owned-only view; a seller product only ever appears here once ACTIVE, same as every other product.",
  })
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional({
    description:
      "Only products that ship from this Indian state (a seller product: the seller's business-address state; a Folia-owned product: Folia's Bengaluru dispatch state). Case-insensitive.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shipFromState?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 12;
}

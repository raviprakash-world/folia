import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

const BADGES = ['New', 'Sale', 'Bestseller', 'Low stock'] as const;
const CARE_LEVELS = ['Easy', 'Moderate', 'Advanced'] as const;

/**
 * Deliberately does NOT accept stockCount/inStock — those are a derived
 * cache InventoryService owns exclusively (Phase 3's design); an admin
 * creating or editing a product's catalog details is a different
 * concern from adjusting its real stock, which goes through
 * POST /inventory/items/:id/adjust instead. Letting this DTO set them
 * directly would let a catalog edit silently desync from real inventory.
 */
export class AdminProductInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ enum: BADGES })
  @IsOptional()
  @IsIn(BADGES)
  badge?: (typeof BADGES)[number];

  @ApiPropertyOptional({ enum: CARE_LEVELS })
  @IsOptional()
  @IsIn(CARE_LEVELS)
  careLevel?: (typeof CARE_LEVELS)[number];
}

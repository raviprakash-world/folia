import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class PersonalizedQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Locally-tracked recently-viewed product ids — this stays client-owned state (see CHANGELOG), passed in rather than stored server-side.',
  })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsString({ each: true })
  recentlyViewedIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Locally-tracked recent search terms — same reasoning as recentlyViewedIds.',
  })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsString({ each: true })
  recentSearches?: string[];
}

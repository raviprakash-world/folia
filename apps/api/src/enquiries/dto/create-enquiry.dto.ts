import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ENQUIRY_TYPES = [
  'GENERAL',
  'GARDENING_SERVICE',
  'CORPORATE_GIFTING',
] as const;
export type EnquiryTypeName = (typeof ENQUIRY_TYPES)[number];

export class CreateEnquiryDto {
  @ApiProperty({ enum: ENQUIRY_TYPES })
  @IsIn(ENQUIRY_TYPES)
  type!: EnquiryTypeName;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[+]?[\d\s().-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  // Type-specific fields. Kept as explicit optional fields (not a free-form
  // object) so the public endpoint only ever stores what we ask for.
  @ApiPropertyOptional({
    description: 'Gardening / corporate: city or delivery location.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({
    description: 'Gardening: the kind of service wanted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Corporate gifting: company name.' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @ApiPropertyOptional({ description: 'Corporate gifting: number of gifts.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Corporate gifting: the occasion.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occasion?: string;

  @ApiPropertyOptional({
    description:
      'Corporate gifting: date the gifts are needed by (YYYY-MM-DD).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'neededBy must be a YYYY-MM-DD date',
  })
  neededBy?: string;
}

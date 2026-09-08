import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SellerAddressInputDto } from './seller-address-input.dto';
import { IsGstin } from '../../common/validators/india-locale';

export class ApplySellerDto {
  @ApiProperty({ description: 'Public storefront/store name.' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({
    description:
      "Public storefront contact email — deliberately separate from the applicant's own login email, which is never shown to customers.",
  })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ example: '9876543210' })
  @IsPhoneNumber('IN', { message: 'Enter a valid Indian phone number.' })
  contactPhone!: string;

  // P0-F — optional: a seller below GST's real registration turnover
  // threshold legitimately has none yet. Format+checksum validated
  // (india-locale.ts) when provided, not merely shape-checked.
  @ApiPropertyOptional({ example: '29AAAAA0000A1ZY' })
  @IsOptional()
  @IsGstin()
  gstin?: string;

  @ApiProperty({ type: SellerAddressInputDto })
  @ValidateNested()
  @Type(() => SellerAddressInputDto)
  address!: SellerAddressInputDto;
}

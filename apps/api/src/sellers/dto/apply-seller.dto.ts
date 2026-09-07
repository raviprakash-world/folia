import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SellerAddressInputDto } from './seller-address-input.dto';

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

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  contactPhone!: string;

  @ApiProperty({ type: SellerAddressInputDto })
  @ValidateNested()
  @Type(() => SellerAddressInputDto)
  address!: SellerAddressInputDto;
}

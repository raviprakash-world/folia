import { ApiPropertyOptional } from '@nestjs/swagger';
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

/**
 * Every field optional — a partial update, not a full re-submission.
 * Editing while REJECTED re-enters the review queue (resets status to
 * APPLIED) — see SellersService.updateProfile — mirroring the Product
 * lifecycle's own explicit REJECTED -> DRAFT loop-back exactly.
 */
export class UpdateSellerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsPhoneNumber('IN', { message: 'Enter a valid Indian phone number.' })
  contactPhone?: string;

  @ApiPropertyOptional({ example: '29AAAAA0000A1ZY' })
  @IsOptional()
  @IsGstin()
  gstin?: string;

  @ApiPropertyOptional({ type: SellerAddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SellerAddressInputDto)
  address?: SellerAddressInputDto;
}

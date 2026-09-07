import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Mirrors AddressInputDto's field shape/validation exactly — this is a
 * seller's business address, not a customer shipping address, so it's its
 * own DTO rather than reusing AddressInputDto directly (that DTO also
 * carries checkout-specific fields like type/preferredTimeSlot that make
 * no sense for a business address). */
export class SellerAddressInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  state!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  country!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  postalCode!: string;
}

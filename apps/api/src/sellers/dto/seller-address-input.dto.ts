import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  INDIA_PIN_CODE_MESSAGE,
  INDIA_PIN_CODE_PATTERN,
} from '../../common/validators/india-locale';

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

  // P0-F — same reasoning as AddressInputDto: this marketplace's GST
  // model, PIN-code shipping estimate, and Shiprocket integration are
  // all India-only already; this makes that explicit instead of
  // silently accepting a value that breaks downstream.
  @ApiProperty({ enum: ['IN'], example: 'IN' })
  @IsIn(['IN'], { message: 'Folia currently operates within India only.' })
  country!: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(INDIA_PIN_CODE_PATTERN, { message: INDIA_PIN_CODE_MESSAGE })
  postalCode!: string;
}

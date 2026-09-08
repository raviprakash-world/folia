import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  INDIA_PIN_CODE_MESSAGE,
  INDIA_PIN_CODE_PATTERN,
} from '../../common/validators/india-locale';

export class AddressInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  @IsPhoneNumber('IN', { message: 'Enter a valid Indian phone number.' })
  phone!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsPhoneNumber('IN', { message: 'Enter a valid Indian phone number.' })
  alternatePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  state!: string;

  // P0-F — was free @IsString(), so any value (or a leftover 'US'/'CA'/
  // 'GB'/'AU' from the frontend's now-removed multi-country dropdown)
  // silently reached ShiprocketProvider, which only ever does India-
  // domestic shipping. This whole marketplace (GST tax model, PIN-code
  // shipping estimate, Shiprocket) already only worked for Indian
  // addresses in practice — this makes that honest instead of silently
  // accepting an address that would fail downstream.
  @ApiProperty({ enum: ['IN'], example: 'IN' })
  @IsIn(['IN'], { message: 'Folia currently ships within India only.' })
  country!: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(INDIA_PIN_CODE_PATTERN, { message: INDIA_PIN_CODE_MESSAGE })
  postalCode!: string;

  @ApiProperty({ enum: ['home', 'office', 'other'] })
  @IsIn(['home', 'office', 'other'])
  type!: 'home' | 'office' | 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: ['morning', 'afternoon', 'evening', 'anytime'] })
  @IsOptional()
  @IsIn(['morning', 'afternoon', 'evening', 'anytime'])
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'anytime';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefaultShipping?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefaultBilling?: boolean;
}

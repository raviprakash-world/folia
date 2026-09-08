import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Matches, Min } from 'class-validator';
import {
  INDIA_PIN_CODE_MESSAGE,
  INDIA_PIN_CODE_PATTERN,
} from '../../common/validators/india-locale';

export class EstimateShippingDto {
  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(INDIA_PIN_CODE_PATTERN, { message: INDIA_PIN_CODE_MESSAGE })
  pincode!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotal!: number;
}

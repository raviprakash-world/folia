import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class EstimateShippingDto {
  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter a 6-digit PIN code.' })
  pincode!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotal!: number;
}

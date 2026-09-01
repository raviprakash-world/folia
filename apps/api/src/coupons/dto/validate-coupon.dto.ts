import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({ example: 'FOLIA10' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  subtotal!: number;
}

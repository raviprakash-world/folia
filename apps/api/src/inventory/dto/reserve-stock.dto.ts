import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ReserveStockDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: ['CART', 'ORDER'] })
  @IsIn(['CART', 'ORDER'])
  referenceType!: 'CART' | 'ORDER';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  referenceId!: string;

  @ApiProperty({
    required: false,
    default: 15,
    description:
      'Minutes until the reservation auto-expires if never committed or released.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlMinutes?: number;
}

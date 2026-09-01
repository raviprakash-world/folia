import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    description:
      'Positive to receive stock, negative to record loss/damage/correction.',
  })
  @IsInt()
  @IsNotEmpty()
  delta!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class AdjustLedgerDto {
  @ApiProperty({
    description: 'Positive to credit the seller, negative to debit. Never 0.',
  })
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description:
      'Required — why this manual adjustment was made, for the audit trail.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}

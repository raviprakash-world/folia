import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectReturnDto {
  @ApiProperty({
    description:
      'Required — the customer-facing reason this claim was rejected, recorded on ReturnRequest.decisionNote.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

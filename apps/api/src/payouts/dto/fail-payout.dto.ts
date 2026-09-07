import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FailPayoutDto {
  @ApiProperty({
    description:
      'Required — why the real transfer failed, for the audit trail and the seller-facing payout history.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  failureReason!: string;
}

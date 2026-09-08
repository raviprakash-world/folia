import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectSellerDto {
  @ApiProperty({
    description:
      'Required — the applicant-facing reason this application was rejected, recorded on Seller.rejectionNote.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

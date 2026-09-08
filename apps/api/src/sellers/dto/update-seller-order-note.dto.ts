import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateSellerOrderNoteDto {
  @ApiProperty({
    description:
      'Private, seller-only fulfillment note. Send an empty string to clear it.',
  })
  @IsString()
  @MaxLength(2000)
  note!: string;
}

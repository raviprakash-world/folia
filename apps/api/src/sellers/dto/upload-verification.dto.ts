import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadVerificationDto {
  @ApiProperty({
    description:
      'A free-text label for what this document is (e.g. "business-registration", "gst-certificate") — no fixed enum yet, matching this phase\'s deliberately minimal scope.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  documentType!: string;
}

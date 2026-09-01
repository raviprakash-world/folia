import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description:
      'The raw verification token from the emailed/dev-returned link',
  })
  @IsString()
  @MinLength(1)
  token!: string;
}

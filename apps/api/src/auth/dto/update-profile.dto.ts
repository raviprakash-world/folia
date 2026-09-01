import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Enter a valid phone number' })
  phone?: string;

  @ApiProperty({
    required: false,
    description:
      'Set automatically by POST /auth/me/avatar — not usually set directly',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}

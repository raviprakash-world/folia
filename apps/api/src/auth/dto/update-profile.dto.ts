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

  // P0-C-6 — deliberately not a DTO field. avatarUrl is set only by
  // POST /auth/me/avatar, which validates size/MIME/magic-bytes
  // (avatar-file.util.ts) and generates the URL server-side from the
  // uploaded file itself. It was previously also settable via this DTO
  // with an arbitrary client-supplied string, letting a user point their
  // own avatar at any URL and bypass all of that upload validation.
}

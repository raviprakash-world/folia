import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsStrongPassword } from './password-field';

export class RegisterDto {
  @ApiProperty({ example: 'Sam' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: 'Rivera' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ example: 'sam@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Correct1Horse',
    description: 'At least 8 characters, one uppercase letter, one number',
  })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ required: false, example: '+1 555 019 2043' })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Enter a valid phone number' })
  phone?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@folia.example' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'folia-demo' })
  @IsString()
  @MinLength(1, { message: 'Enter your password' })
  password!: string;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Extends the refresh token/session lifetime when true',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

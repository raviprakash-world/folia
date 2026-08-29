import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from './password-field';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Enter your current password' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewCorrect1Password' })
  @IsStrongPassword()
  newPassword!: string;
}

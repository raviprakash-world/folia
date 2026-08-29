import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from './password-field';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The raw reset token from the emailed/dev-returned link',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({ example: 'NewCorrect1Password' })
  @IsStrongPassword()
  password!: string;
}

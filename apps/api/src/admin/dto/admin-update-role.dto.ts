import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdminUpdateRoleDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(1)
  role!: string;
}

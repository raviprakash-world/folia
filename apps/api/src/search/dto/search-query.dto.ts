import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'monstera' })
  @IsString()
  @MinLength(1)
  q!: string;
}

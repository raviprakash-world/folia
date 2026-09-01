import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateNotesDto {
  @ApiProperty()
  @IsString()
  notes!: string;
}

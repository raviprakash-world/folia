import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveReturnDto {
  @ApiPropertyOptional({
    description: 'Optional admin note recorded alongside the decision.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

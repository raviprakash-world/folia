import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

// P0-C-6 — defense-in-depth only: UsersService.adminUpdateRole already
// validates the target role exists in the real Role table before writing
// (so an unknown value was never actually assignable), but the DTO
// previously accepted any non-empty string with no allowlist at all. These
// are the three roles this codebase seeds (prisma/seed.ts).
const KNOWN_ROLE_NAMES = ['customer', 'seller', 'admin'] as const;

export class AdminUpdateRoleDto {
  @ApiProperty({ example: 'admin', enum: KNOWN_ROLE_NAMES })
  @IsString()
  @MinLength(1)
  @IsIn(KNOWN_ROLE_NAMES)
  role!: string;
}

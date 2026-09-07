import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared by suspend/deactivate — an optional admin note, recorded on
 * Seller.statusNote. Unlike RejectSellerDto's reason, this is not required:
 * the brief only mandates a note for the customer-facing rejection reason,
 * not for suspend/deactivate specifically. */
export class SellerStatusNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

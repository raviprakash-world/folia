import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Shared by reject AND request-changes — both admin actions the
 * governing brief names transition the SAME underlying way (SUBMITTED/
 * UNDER_REVIEW -> REJECTED with a note the seller sees on their next
 * edit) since the given Product lifecycle diagram has only one rejection
 * branch, not two. The audit trail still distinguishes which one an
 * admin actually chose — see SellerProductsService.adminReject/
 * adminRequestChanges. */
export class RejectSellerProductDto {
  @ApiProperty({
    description:
      'Required — the seller-facing reason, recorded on Product.rejectionNote.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveReturnDto {
  @ApiPropertyOptional({
    description: 'Optional admin note recorded alongside the decision.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /**
   * Phase 6D-4C — the only resolution type an admin may choose explicitly.
   * REFUND and FOLIA_STORE_CREDIT are never client-settable (ReturnsService
   * derives them automatically from the order's paymentMethod at financial-
   * resolution time); REPLACEMENT is a physical-fulfillment decision, not a
   * money amount, so an admin choosing it here is safe. ReturnsService.
   * adminApprove additionally rejects this unless the claim is a DOA_CLAIM.
   */
  @ApiPropertyOptional({
    description:
      'Set to REPLACEMENT to resolve this claim by shipping a free replacement instead of a refund/store-credit. Only valid for DOA/damage claims.',
    enum: ['REPLACEMENT'],
  })
  @IsOptional()
  @IsIn(['REPLACEMENT'])
  resolutionType?: 'REPLACEMENT';
}

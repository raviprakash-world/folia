import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

  /**
   * Phase 6D-4D — overrides return-policy.util's
   * defaultRequiresReverseLogistics(claimType) default (false for
   * DOA_CLAIM, true for STANDARD_RETURN). When true, ReturnsService.
   * resolveClaim refuses to execute ANY resolution (refund, store credit,
   * or replacement) until ReturnsService.markItemReceived has recorded
   * itemReceivedAt.
   */
  @ApiPropertyOptional({
    description:
      'Overrides the default reverse-logistics requirement for this claim. When true, financial/replacement resolution is blocked until the item is marked received.',
  })
  @IsOptional()
  @IsBoolean()
  requiresReverseLogistics?: boolean;
}

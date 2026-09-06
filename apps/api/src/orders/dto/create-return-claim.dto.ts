import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, plainToInstance } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

const RETURN_CLAIM_REASONS = [
  'no-longer-needed',
  'wrong-item',
  'damaged-in-transit',
  'not-as-described',
  'changed-mind',
  'other',
  'doa',
] as const;

export class ReturnClaimItemDto {
  @ApiProperty({ description: 'The OrderItem being claimed against.' })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * Submitted as multipart/form-data alongside evidence files (see
 * OrdersController.createReturnClaim) — `items` therefore arrives as a
 * JSON-encoded string field, not a native array, since multipart form
 * fields have no concept of nested structures. Parsed defensively:
 * malformed JSON becomes `undefined` rather than throwing mid-transform,
 * which @IsArray() then reports as an ordinary clean validation error.
 *
 * Deliberately has NO `evidenceUrls` (or any URL-shaped) field — evidence
 * comes exclusively from the multipart files themselves
 * (@UploadedFiles()), never from a client-supplied string, so there is no
 * way to submit an arbitrary external URL as "evidence." Combined with
 * this app's global ValidationPipe (`forbidNonWhitelisted: true`), a
 * client attempting to sneak in an `evidenceUrls` field is rejected
 * outright, not silently ignored.
 */
export class CreateReturnClaimDto {
  @ApiProperty({ type: [ReturnClaimItemDto] })
  @Transform(({ value }: { value: unknown }) => {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    if (!Array.isArray(parsed)) return undefined;
    // Instantiated here directly (rather than relying on a separate
    // @Type(() => ReturnClaimItemDto) to do it after this @Transform
    // runs) — stacking @Transform and @Type on the same property has
    // unreliable ordering in class-transformer, and this app's global
    // ValidationPipe (`whitelist: true, forbidNonWhitelisted: true`)
    // needs each array element to already be a REAL ReturnClaimItemDto
    // instance for its property-whitelisting to work correctly against
    // that class's own declared properties, not a plain JSON object.
    return parsed.map((item) => plainToInstance(ReturnClaimItemDto, item));
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  items!: ReturnClaimItemDto[];

  @ApiProperty({ enum: RETURN_CLAIM_REASONS })
  @IsIn(RETURN_CLAIM_REASONS)
  reason!: (typeof RETURN_CLAIM_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const DELIVERY_METHODS = ['standard', 'express', 'same-day', 'pickup'] as const;
const PAYMENT_METHODS = [
  'credit-card',
  'debit-card',
  'upi',
  'net-banking',
  'cod',
  'wallet',
] as const;

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  shippingAddressId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  billingAddressId!: string;

  @ApiProperty({ enum: DELIVERY_METHODS })
  @IsIn(DELIVERY_METHODS)
  deliveryMethod!: (typeof DELIVERY_METHODS)[number];

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @ApiProperty({
    description:
      'Already-masked display value from the client — e.g. "Visa •••• 4242". Never a raw card/account number.',
  })
  @IsString()
  @MinLength(1)
  paymentDisplayLabel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNotes?: string;
}

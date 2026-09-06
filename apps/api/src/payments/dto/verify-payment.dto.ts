import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    description: "Razorpay's order id, from the Checkout.js success handler.",
  })
  @IsString()
  @MinLength(1)
  providerOrderId!: string;

  @ApiProperty({
    description: "Razorpay's payment id, from the Checkout.js success handler.",
  })
  @IsString()
  @MinLength(1)
  providerPaymentId!: string;

  @ApiProperty({
    description:
      'HMAC signature from the Checkout.js success handler — verified server-side against Razorpay, never trusted on its own.',
  })
  @IsString()
  @MinLength(1)
  signature!: string;
}

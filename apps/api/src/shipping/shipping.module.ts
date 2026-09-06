import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SHIPPING_PROVIDER } from './providers/shipping-provider.interface';
import { ShiprocketProvider } from './providers/shiprocket.provider';

@Module({
  controllers: [ShippingController],
  providers: [
    ShippingService,
    { provide: SHIPPING_PROVIDER, useClass: ShiprocketProvider },
  ],
  exports: [SHIPPING_PROVIDER],
})
export class ShippingModule {}

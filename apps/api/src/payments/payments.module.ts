import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { CartModule } from '../cart/cart.module';
import { AppConfigModule } from '../config/config.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [CartModule, AppConfigModule, InventoryModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}

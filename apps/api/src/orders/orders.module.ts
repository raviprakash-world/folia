import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnsService } from './returns.service';
import { CartModule } from '../cart/cart.module';
import { AddressesModule } from '../addresses/addresses.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AppConfigModule } from '../config/config.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    CartModule,
    AddressesModule,
    CouponsModule,
    PaymentsModule,
    InventoryModule,
    TrackingModule,
    AppConfigModule,
    ShippingModule,
    StorageModule,
    AuditModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ReturnsService],
  exports: [OrdersService, ReturnsService],
})
export class OrdersModule {}

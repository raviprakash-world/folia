import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { SellerProductsController } from './seller-products.controller';
import { SellerProductsService } from './seller-products.service';
import { RolesModule } from '../roles/roles.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

/**
 * Exports SellersService so SellerGuard (registered globally as an
 * APP_GUARD in app.module.ts) can be constructed with it via Nest's root
 * injector — the same wiring shape JwtAuthGuard/RolesGuard already rely
 * on — and exports both services so AdminModule can import them for
 * AdminSellersController/AdminSellerProductsController.
 */
@Module({
  imports: [
    RolesModule,
    AuditModule,
    StorageModule,
    InventoryModule,
    WarehousesModule,
  ],
  controllers: [SellersController, SellerProductsController],
  providers: [SellersService, SellerProductsService],
  exports: [SellersService, SellerProductsService],
})
export class SellersModule {}

import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminReturnsController } from './admin-returns.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellerProductsController } from './admin-seller-products.controller';
import { AdminCommissionsController } from './admin-commissions.controller';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    ProductsModule,
    OrdersModule,
    InventoryModule,
    UsersModule,
    AuditModule,
    SellersModule,
  ],
  controllers: [
    AdminProductsController,
    AdminOrdersController,
    AdminReturnsController,
    AdminInventoryController,
    AdminUsersController,
    AdminSellersController,
    AdminSellerProductsController,
    AdminCommissionsController,
  ],
})
export class AdminModule {}

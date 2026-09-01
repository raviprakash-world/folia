import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminUsersController } from './admin-users.controller';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    ProductsModule,
    OrdersModule,
    InventoryModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [
    AdminProductsController,
    AdminOrdersController,
    AdminInventoryController,
    AdminUsersController,
  ],
})
export class AdminModule {}

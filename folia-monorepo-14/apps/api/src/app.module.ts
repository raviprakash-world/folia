import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CouponsModule } from './coupons/coupons.module';
import { ShippingModule } from './shipping/shipping.module';
import { AddressesModule } from './addresses/addresses.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AdminModule } from './admin/admin.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    AppConfigModule,
    EventEmitterModule.forRoot({ global: true }),
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.isProduction ? 'info' : 'debug',
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
          autoLogging: true,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          // Phase 12 observability — every log line for a request now
          // carries a real correlation id. Honors an incoming
          // X-Request-Id (a load balancer or upstream service may
          // already have assigned one, which should be preserved for
          // tracing across services, not overwritten) and generates a
          // real UUID otherwise. genReqId's real signature — (req, res)
          // => id, not just (req) => id — was checked directly against
          // pino-http's own type definitions before being used.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const existing = req.headers['x-request-id'];
            const id = typeof existing === 'string' ? existing : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }], // generous global default; sensitive auth endpoints set their own tighter @Throttle()
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ReviewsModule,
    WarehousesModule,
    InventoryModule,
    CartModule,
    WishlistModule,
    CouponsModule,
    ShippingModule,
    AddressesModule,
    PaymentsModule,
    OrdersModule,
    SearchModule,
    AnalyticsModule,
    RecommendationsModule,
    AdminModule,
    JobsModule,
    NotificationsModule,
  ],
  providers: [
    // Order matters: ThrottlerGuard first (rate-limit before doing any
    // auth work), then JwtAuthGuard (secure-by-default — every route
    // requires a valid access token unless marked @Public()), then
    // RolesGuard (narrows access further for routes with @Roles()/
    // @RequirePermissions() — a no-op for everything else).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

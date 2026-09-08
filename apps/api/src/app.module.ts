import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
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
import { EmailModule } from './email/email.module';
import { SellersModule } from './sellers/sellers.module';
import { PayoutsModule } from './payouts/payouts.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { SellerGuard } from './sellers/guards/seller.guard';

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
          // P0-C-10 — the outgoing Set-Cookie header (refresh token,
          // guest-cart id) carries the same secret-bearing value as the
          // incoming Cookie header below, but on the response side. Pino's
          // autoLogging serializes res.headers by default, so without this
          // path the refresh token would land in plaintext server logs on
          // every /auth/login, /auth/register, and /auth/refresh call.
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
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
    // P0-F follow-up — rate limiting previously used @nestjs/throttler's
    // default in-memory storage: correct at one replica, but each
    // instance would track its own separate counter the moment this is
    // ever scaled past one — silently defeating the whole point of the
    // register/login/reset-password throttles P0-C added. Backed by
    // Redis now (already running, already used elsewhere in this app),
    // via a purpose-built package rather than a hand-rolled Redis
    // client: ThrottlerStorage's increment() has to be atomic under
    // concurrent requests (check-count-then-increment is a real race
    // otherwise), which this package does with a Lua script — the kind
    // of correctness a from-scratch implementation risks getting subtly
    // wrong in exactly the code path meant to prevent abuse.
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }], // generous global default; sensitive auth endpoints set their own tighter @Throttle()
        storage: new ThrottlerStorageRedisService(config.redisUrl),
      }),
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
    EmailModule,
    SellersModule,
    PayoutsModule,
  ],
  providers: [
    // Order matters: ThrottlerGuard first (rate-limit before doing any
    // auth work), then JwtAuthGuard (secure-by-default — every route
    // requires a valid access token unless marked @Public()), then
    // RolesGuard (narrows access further for routes with @Roles()/
    // @RequirePermissions() — a no-op for everything else), then
    // SellerGuard (Marketplace Phase 1 — narrows further still for routes
    // with @RequireSeller(), resolving the caller's own Seller row from
    // their session; also a no-op for everything else). SellerGuard runs
    // last because it depends on request.user, which only JwtAuthGuard
    // populates.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SellerGuard },
  ],
})
export class AppModule {}

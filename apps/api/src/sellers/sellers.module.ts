import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';

/**
 * Exports SellersService so SellerGuard (registered globally as an
 * APP_GUARD in app.module.ts) can be constructed with it via Nest's root
 * injector — the same wiring shape JwtAuthGuard/RolesGuard already rely on.
 */
@Module({
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}

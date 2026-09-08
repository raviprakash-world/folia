import { Module } from '@nestjs/common';
import { SellerLedgerService } from './seller-ledger.service';
import { SellerPayoutService } from './seller-payout.service';
import { SellerEarningsController } from './seller-earnings.controller';
import { AuditModule } from '../audit/audit.module';

/**
 * Marketplace Phase 9 — the seller financial ledger + payout domain.
 * Exports both services: PaymentsModule needs SellerLedgerService (to
 * record SALE/COMMISSION entries at order-confirmation time), AdminModule
 * needs both (for AdminPayoutsController).
 */
@Module({
  imports: [AuditModule],
  controllers: [SellerEarningsController],
  providers: [SellerLedgerService, SellerPayoutService],
  exports: [SellerLedgerService, SellerPayoutService],
})
export class PayoutsModule {}

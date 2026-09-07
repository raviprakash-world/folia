import { ForbiddenException } from '@nestjs/common';
import { SellerFulfillmentController } from './seller-fulfillment.controller';
import type { OrdersService } from './orders.service';
import type { Seller } from '@prisma/client';

/**
 * P0-C-5 regression test — the first controller-level spec in this
 * codebase (every other controller here is a thin wiring layer with no
 * dedicated test file; services carry the test coverage). This check
 * genuinely lives in the controller, not OrdersService, because
 * shipOrderSellerGroup is shared by three callers with different trust
 * levels — admin (no seller-status gate, admin-orders.controller.ts),
 * an internal auto-ship path (orders.service.ts's own call to itself),
 * and this seller-facing route (the only one that should be blocked for
 * a SUSPENDED/DEACTIVATED seller) — so the gate can't move into the
 * shared method without incorrectly blocking the other two callers too.
 */
describe('SellerFulfillmentController', () => {
  function makeSeller(overrides: Partial<Seller> = {}): Seller {
    return { id: 'seller-1', status: 'ACTIVE', ...overrides } as Seller;
  }

  function createController() {
    const ordersService = {
      shipOrderSellerGroup: jest.fn().mockResolvedValue({ id: 'group-1' }),
    };
    const controller = new SellerFulfillmentController(
      ordersService as unknown as OrdersService,
    );
    return { controller, ordersService };
  }

  it('ships when the seller is ACTIVE', async () => {
    const { controller, ordersService } = createController();
    await controller.ship(makeSeller({ status: 'ACTIVE' }), 'group-1');
    expect(ordersService.shipOrderSellerGroup).toHaveBeenCalledWith(
      'group-1',
      'seller-1',
    );
  });

  it.each([
    'SUSPENDED',
    'DEACTIVATED',
    'APPLIED',
    'UNDER_REVIEW',
    'REJECTED',
    'APPROVED',
  ])('rejects a %s seller with 403 and never calls the service', (status) => {
    const { controller, ordersService } = createController();
    expect(() =>
      controller.ship(
        makeSeller({ status: status as Seller['status'] }),
        'group-1',
      ),
    ).toThrow(ForbiddenException);
    expect(ordersService.shipOrderSellerGroup).not.toHaveBeenCalled();
  });
});

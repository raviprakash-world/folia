import { ForbiddenException } from '@nestjs/common';
import { SellerOrdersController } from './seller-orders.controller';
import type { SellerOrdersService } from './seller-orders.service';
import type { Seller } from '@prisma/client';

/**
 * P0-C-5 regression test — see seller-fulfillment.controller.spec.ts's
 * doc comment for why this check lives in the controller rather than
 * the service in this codebase (SellerGuard is deliberately
 * status-agnostic; per-write-endpoint gating is the established
 * pattern, matching SellerProductsService.submitForModeration/archive).
 */
describe('SellerOrdersController — updateNote authorization', () => {
  function makeSeller(overrides: Partial<Seller> = {}): Seller {
    return { id: 'seller-1', status: 'ACTIVE', ...overrides } as Seller;
  }

  function createController() {
    const sellerOrdersService = {
      updateSellerNote: jest.fn().mockResolvedValue({ id: 'group-1' }),
    };
    const controller = new SellerOrdersController(
      sellerOrdersService as unknown as SellerOrdersService,
    );
    return { controller, sellerOrdersService };
  }

  it('updates the note when the seller is ACTIVE', async () => {
    const { controller, sellerOrdersService } = createController();
    await controller.updateNote(makeSeller({ status: 'ACTIVE' }), 'group-1', {
      note: 'Packed and ready.',
    });
    expect(sellerOrdersService.updateSellerNote).toHaveBeenCalledWith(
      'seller-1',
      'group-1',
      'Packed and ready.',
    );
  });

  it.each(['SUSPENDED', 'DEACTIVATED'])(
    'rejects a %s seller with 403 and never calls the service',
    (status) => {
      const { controller, sellerOrdersService } = createController();
      expect(() =>
        controller.updateNote(
          makeSeller({ status: status as Seller['status'] }),
          'group-1',
          { note: 'x' },
        ),
      ).toThrow(ForbiddenException);
      expect(sellerOrdersService.updateSellerNote).not.toHaveBeenCalled();
    },
  );
});

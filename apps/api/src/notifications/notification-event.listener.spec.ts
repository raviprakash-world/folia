// Focused on PAYMENT_EVENTS.REFUNDED — the one handler this Phase 6 gap
// fix added test coverage for. No spec file existed for this listener
// before this fix (unlike EmailEventListener's), so this deliberately
// does not attempt to backfill coverage for the pre-existing handlers
// (order placed/cancelled/return-requested/status-changed/etc.) — out of
// scope for this change.
import { NotificationEventListener } from './notification-event.listener';

function createDeps() {
  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    seller: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    },
  };
  const listener = new NotificationEventListener(
    notificationsService as never,
    prisma as never,
  );
  return { listener, notificationsService, prisma };
}

describe('NotificationEventListener.handlePaymentRefunded', () => {
  it('creates an ORDER notification with the refunded amount and a working link to the order', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handlePaymentRefunded({
      orderId: 'FOL-1',
      userId: 'user-1',
      paymentId: 'pay-1',
      amount: 71.3,
      refundId: 'refund-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Refund Processed',
      message: '₹71.30 was refunded for order FOL-1.',
      href: '/account/orders/FOL-1',
    });
  });

  it('omits the order link/reference when orderId is null, rather than linking to a nonexistent order', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handlePaymentRefunded({
      orderId: null,
      userId: 'user-1',
      paymentId: 'pay-1',
      amount: 20,
      refundId: 'refund-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Refund Processed',
      message: '₹20.00 was refunded.',
      href: undefined,
    });
  });

  it("follows the same pattern as the other payment-event handlers — same event-driven, no-try/catch shape (a listener failure is EventEmitter2's concern, not this class's)", async () => {
    const { listener, notificationsService } = createDeps();
    notificationsService.create.mockRejectedValue(new Error('db unavailable'));

    await expect(
      listener.handlePaymentRefunded({
        orderId: 'FOL-2',
        userId: 'user-1',
        paymentId: 'pay-2',
        amount: 10,
        refundId: 'refund-2',
      }),
    ).rejects.toThrow('db unavailable');
  });
});

// Phase 6D-4F — the four return/DOA resolution events that previously had
// no listener at all (see docs/PHASE_6D_MIGRATION_DESIGN.md).
describe('NotificationEventListener.handleReturnApproved', () => {
  it('creates an ORDER notification linking to the order', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleReturnApproved({
      returnRequestId: 'rr-1',
      orderId: 'FOL-1',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Return Approved',
      message: 'Your return/DOA claim for order FOL-1 was approved.',
      href: '/account/orders/FOL-1',
    });
  });
});

describe('NotificationEventListener.handleReturnRejected', () => {
  it('creates an ORDER notification including the rejection reason', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleReturnRejected({
      returnRequestId: 'rr-1',
      orderId: 'FOL-1',
      userId: 'user-1',
      reason: 'Outside the return window',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Return Not Approved',
      message:
        'Your return/DOA claim for order FOL-1 was not approved: Outside the return window',
      href: '/account/orders/FOL-1',
    });
  });
});

describe('NotificationEventListener.handleStoreCreditIssued', () => {
  it('creates an ORDER notification with the issued amount', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleStoreCreditIssued({
      returnRequestId: 'rr-1',
      orderId: 'FOL-1',
      userId: 'user-1',
      amount: 198,
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Store Credit Issued',
      message: '₹198.00 in store credit was issued for order FOL-1.',
      href: '/account/orders/FOL-1',
    });
  });
});

describe('NotificationEventListener.handleReplacementIssued', () => {
  it('creates an ORDER notification linking to the NEW replacement order, not the original', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleReplacementIssued({
      returnRequestId: 'rr-1',
      orderId: 'FOL-1',
      replacementOrderId: 'FOL-2',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Replacement On The Way',
      message: 'A free replacement for order FOL-1 was created as order FOL-2.',
      href: '/account/orders/FOL-2',
    });
  });
});

// Marketplace Phase 18 — seller lifecycle, seller-product moderation, and
// payout-paid events all previously had "no listener exists yet" per
// notification.events.ts's own comments (Phases 2/3/9). This phase closes
// that gap.
describe('NotificationEventListener — Marketplace Phase 18', () => {
  it('handleSellerApplied creates a SELLER notification linking to the seller profile', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerApplied({
      sellerId: 'seller-1',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'SELLER',
      title: 'Application Received',
      message:
        "We've received your seller application and will review it shortly.",
      href: '/seller/profile',
    });
  });

  it('handleSellerApproved creates a SELLER notification', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerApproved({
      sellerId: 'seller-1',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SELLER',
        title: 'Seller Application Approved',
        href: '/seller/profile',
      }),
    );
  });

  it('handleSellerRejected includes the real rejection reason', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerRejected({
      sellerId: 'seller-1',
      userId: 'user-1',
      reason: 'Business documents did not match the application.',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SELLER',
        message:
          'Your seller application was not approved: Business documents did not match the application.',
      }),
    );
  });

  it('handleSellerSuspended includes the admin note when given', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerSuspended({
      sellerId: 'seller-1',
      userId: 'user-1',
      note: 'Multiple customer complaints under review.',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Your seller account was suspended: Multiple customer complaints under review.',
      }),
    );
  });

  it('handleSellerSuspended omits the note clause when none was given', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerSuspended({
      sellerId: 'seller-1',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your seller account was suspended.',
      }),
    );
  });

  it('handleSellerReactivated creates a SELLER notification', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerReactivated({
      sellerId: 'seller-1',
      userId: 'user-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SELLER',
        title: 'Seller Account Reactivated',
      }),
    );
  });

  it('handleSellerDeactivated includes the admin note when given', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerDeactivated({
      sellerId: 'seller-1',
      userId: 'user-1',
      note: 'Requested by the seller.',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Your seller account was deactivated: Requested by the seller.',
      }),
    );
  });

  it('handleProductSubmitted resolves the userId from the sellerId (the payload only carries sellerId)', async () => {
    const { listener, notificationsService, prisma } = createDeps();

    await listener.handleProductSubmitted({
      productId: 'prod-1',
      sellerId: 'seller-1',
    });

    expect(prisma.seller.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      select: { userId: true },
    });
    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'SELLER',
      title: 'Product Submitted For Review',
      message: 'Your product listing was submitted and is awaiting review.',
      href: '/seller/products/prod-1',
    });
  });

  it('handleProductApproved resolves the userId and links to the product', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleProductApproved({
      productId: 'prod-1',
      sellerId: 'seller-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SELLER',
        title: 'Product Approved',
        href: '/seller/products/prod-1',
      }),
    );
  });

  it('handleProductRejected includes the real rejection reason', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleProductRejected({
      productId: 'prod-1',
      sellerId: 'seller-1',
      reason: 'Photos do not match the description.',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Your product listing was not approved: Photos do not match the description.',
      }),
    );
  });

  it('handleProductDeactivated creates a SELLER notification', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleProductDeactivated({
      productId: 'prod-1',
      sellerId: 'seller-1',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SELLER',
        title: 'Product Archived',
      }),
    );
  });

  it('handleSellerPayoutPaid includes the real payout amount and links to earnings', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handleSellerPayoutPaid({
      sellerId: 'seller-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      amount: 90,
    });

    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'SELLER',
      title: 'Payout Sent',
      message: '₹90.00 was paid out to you.',
      href: '/seller/earnings',
    });
  });
});

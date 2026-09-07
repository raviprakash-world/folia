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
  const listener = new NotificationEventListener(notificationsService as never);
  return { listener, notificationsService };
}

describe('NotificationEventListener.handlePaymentRefunded', () => {
  it('creates an ORDER notification with the refunded amount and a working link to the order', async () => {
    const { listener, notificationsService } = createDeps();

    await listener.handlePaymentRefunded({
      orderId: 'FOL-1',
      userId: 'user-1',
      paymentId: 'pay-1',
      amount: 71.3,
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

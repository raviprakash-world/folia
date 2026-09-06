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

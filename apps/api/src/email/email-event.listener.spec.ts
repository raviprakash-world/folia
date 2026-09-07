import { EmailEventListener } from './email-event.listener';
import type { SendEmailInput } from './email.interface';

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', email: 'sam@example.com', ...overrides };
}

function createDeps() {
  const emailService = {
    send: jest
      .fn<Promise<void>, [SendEmailInput]>()
      .mockResolvedValue(undefined),
  };
  const usersService = { findById: jest.fn().mockResolvedValue(makeUser()) };
  const config = { frontendUrl: 'http://localhost:5173' };

  const listener = new EmailEventListener(
    emailService,
    usersService as never,
    config as never,
  );

  return { listener, emailService, usersService, config };
}

/** The single email this mock's `.send` call captured, typed as the real SendEmailInput — avoids the expect.objectContaining/stringContaining generic-typing dance entirely. */
function sentEmail(emailService: {
  send: jest.Mock<Promise<void>, [SendEmailInput]>;
}): SendEmailInput {
  return emailService.send.mock.calls[0][0];
}

describe('EmailEventListener', () => {
  it('handleOrderCreated looks up the real user email and sends an order-confirmation email with a working account-order link', async () => {
    const { listener, emailService, usersService } = createDeps();

    await listener.handleOrderCreated({
      orderId: 'FOL-1',
      userId: 'user-1',
      total: 56.18,
    });

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    const email = sentEmail(emailService);
    expect(email.to).toBe('sam@example.com');
    expect(email.subject).toContain('FOL-1');
    expect(email.html).toContain('/account/orders/FOL-1');
  });

  it('handleOrderCancelled sends the cancellation email', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleOrderCancelled({ orderId: 'FOL-2', userId: 'user-1' });
    expect(sentEmail(emailService).subject).toContain('cancelled');
  });

  it('handleOrderReturnRequested sends the return-requested email', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleOrderReturnRequested({
      orderId: 'FOL-3',
      userId: 'user-1',
    });
    expect(sentEmail(emailService).subject).toContain('Return');
  });

  it.each(['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const)(
    'handleOrderStatusChanged sends a real email for a %s transition',
    async (status) => {
      const { listener, emailService } = createDeps();
      await listener.handleOrderStatusChanged({
        orderId: 'FOL-4',
        userId: 'user-1',
        status,
      });
      expect(sentEmail(emailService).to).toBe('sam@example.com');
    },
  );

  it('handlePaymentRefunded sends a real refund email with the amount and a working order link', async () => {
    const { listener, emailService } = createDeps();
    await listener.handlePaymentRefunded({
      orderId: 'FOL-7',
      userId: 'user-1',
      paymentId: 'pay-1',
      amount: 71.3,
    });
    const email = sentEmail(emailService);
    expect(email.to).toBe('sam@example.com');
    expect(email.html).toContain('/account/orders/FOL-7');
    expect(email.text).toContain('71.30');
  });

  it('handlePaymentRefunded skips sending (does not throw) when the payload has no orderId to link to', async () => {
    const { listener, emailService } = createDeps();
    await listener.handlePaymentRefunded({
      orderId: null,
      userId: 'user-1',
      paymentId: 'pay-1',
      amount: 20,
    });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('never throws when the email provider fails for a refund email — same non-fatal-side-effect contract as every other handler', async () => {
    const { listener, emailService } = createDeps();
    emailService.send.mockRejectedValue(new Error('Resend is down'));

    await expect(
      listener.handlePaymentRefunded({
        orderId: 'FOL-8',
        userId: 'user-1',
        paymentId: 'pay-1',
        amount: 15,
      }),
    ).resolves.toBeUndefined();
  });

  // Phase 6D-4F — the four return/DOA resolution events that previously
  // had no email handler at all.
  it('handleReturnApproved sends the return-approved email with a working order link', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleReturnApproved({
      returnRequestId: 'rr-1',
      orderId: 'FOL-9',
      userId: 'user-1',
    });
    const email = sentEmail(emailService);
    expect(email.subject).toContain('approved');
    expect(email.html).toContain('/account/orders/FOL-9');
  });

  it('handleReturnRejected sends the return-rejected email including the reason', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleReturnRejected({
      returnRequestId: 'rr-1',
      orderId: 'FOL-10',
      userId: 'user-1',
      reason: 'Outside the return window',
    });
    const email = sentEmail(emailService);
    expect(email.text).toContain('Outside the return window');
    expect(email.html).toContain('/account/orders/FOL-10');
  });

  it('handleStoreCreditIssued sends the store-credit email with the exact amount', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleStoreCreditIssued({
      returnRequestId: 'rr-1',
      orderId: 'FOL-11',
      userId: 'user-1',
      amount: 198,
    });
    const email = sentEmail(emailService);
    expect(email.text).toContain('198.00');
    expect(email.html).toContain('/account/orders/FOL-11');
  });

  it('handleReplacementIssued sends the replacement email linking to the NEW replacement order, not the original', async () => {
    const { listener, emailService } = createDeps();
    await listener.handleReplacementIssued({
      returnRequestId: 'rr-1',
      orderId: 'FOL-12',
      replacementOrderId: 'FOL-13',
      userId: 'user-1',
    });
    const email = sentEmail(emailService);
    expect(email.html).toContain('/account/orders/FOL-13');
    expect(email.html).not.toContain('/account/orders/FOL-12');
    expect(email.text).toContain('FOL-12');
  });

  it('never throws when the email provider fails for any of the four new return-resolution emails', async () => {
    const { listener, emailService } = createDeps();
    emailService.send.mockRejectedValue(new Error('Resend is down'));

    await expect(
      listener.handleReturnApproved({
        returnRequestId: 'rr-1',
        orderId: 'FOL-14',
        userId: 'user-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('handlePaymentFailed links to the cart, not a nonexistent order (Phase 2: a failed attempt never produced an order)', async () => {
    const { listener, emailService } = createDeps();
    await listener.handlePaymentFailed({
      userId: 'user-1',
      paymentId: 'pay-1',
      errorDescription: 'Card declined',
    });
    const email = sentEmail(emailService);
    expect(email.html).toContain('/cart');
    expect(email.text).toContain('Card declined');
  });

  it('is a safe no-op when the user no longer exists — not an error worth logging', async () => {
    const { listener, emailService, usersService } = createDeps();
    usersService.findById.mockResolvedValue(null);

    await listener.handleOrderCreated({
      orderId: 'FOL-5',
      userId: 'deleted-user',
      total: 10,
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('never throws when the email provider fails — an email outage must not break whatever triggered the event', async () => {
    const { listener, emailService } = createDeps();
    emailService.send.mockRejectedValue(new Error('Resend is down'));

    await expect(
      listener.handleOrderCreated({
        orderId: 'FOL-6',
        userId: 'user-1',
        total: 10,
      }),
    ).resolves.toBeUndefined();
  });
});

import { InternalServerErrorException } from '@nestjs/common';
import { RazorpayProvider } from './razorpay.provider';

/**
 * Only what's actually ours to test: the "fail loudly with no keys
 * configured" behavior (see the class's own doc comment on why the
 * client is constructed lazily) and the paise/rupee conversion boundary
 * (Razorpay's API is minor-unit-only; the rest of this codebase is
 * major-unit-only — this file is where that conversion happens, exactly
 * once, and a bug here would silently overcharge or undercharge by 100x).
 * The actual HTTP calls to Razorpay's orders/payments/refunds endpoints
 * are the SDK's own responsibility, not re-tested here — see
 * docs/API_INTEGRATION_STATUS.md for the real sandbox verification this
 * still needs once test keys exist.
 */
describe('RazorpayProvider — fails loudly with no keys configured', () => {
  function makeProvider(overrides: Record<string, unknown> = {}) {
    const config = {
      razorpayKeyId: undefined,
      razorpayKeySecret: undefined,
      razorpayWebhookSecret: undefined,
      ...overrides,
    };
    return new RazorpayProvider(config as never);
  }

  it('createOrder throws a clear, specific error rather than an SDK crash when no keys are set', async () => {
    const provider = makeProvider();
    await expect(
      provider.createOrder({ amount: 100, currency: 'INR', receipt: 'FOL-1' }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      provider.createOrder({ amount: 100, currency: 'INR', receipt: 'FOL-1' }),
    ).rejects.toThrow(/RAZORPAY_KEY_ID\/RAZORPAY_KEY_SECRET are unset/);
  });

  it('verifyPaymentSignature throws when key secret is unset', () => {
    const provider = makeProvider();
    expect(() =>
      provider.verifyPaymentSignature({
        providerOrderId: 'order_1',
        providerPaymentId: 'pay_1',
        signature: 'sig',
      }),
    ).toThrow(/RAZORPAY_KEY_SECRET is unset/);
  });

  it('verifyWebhookSignature throws when the webhook secret is unset (distinct from the key secret)', () => {
    const provider = makeProvider({ razorpayKeySecret: 'has-a-key-secret' });
    expect(() => provider.verifyWebhookSignature('{}', 'sig')).toThrow(
      /RAZORPAY_WEBHOOK_SECRET is unset/,
    );
  });

  it('refund throws when no keys are set, same as createOrder', async () => {
    const provider = makeProvider();
    await expect(
      provider.refund({ providerPaymentId: 'pay_1' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

describe('RazorpayProvider — amount unit conversion (rupees in this codebase, paise for Razorpay)', () => {
  it('createOrder multiplies rupees by 100 before calling the SDK', async () => {
    const provider = new RazorpayProvider({
      razorpayKeyId: 'rzp_test_x',
      razorpayKeySecret: 'secret',
    } as never);
    const create = jest.fn().mockResolvedValue({ id: 'order_abc' });
    // Reaching into the private lazily-constructed client is the only way
    // to intercept the SDK call without mocking the whole `razorpay`
    // package — acceptable here since this test exists purely to pin the
    // *100 conversion, not to re-verify the SDK's own HTTP behavior.
    (provider as unknown as { client: unknown }).client = {
      orders: { create },
    };

    const result = await provider.createOrder({
      amount: 71.3,
      currency: 'INR',
      receipt: 'FOL-1',
    });

    expect(create).toHaveBeenCalledWith({
      amount: 7130,
      currency: 'INR',
      receipt: 'FOL-1',
    });
    expect(result.providerOrderId).toBe('order_abc');
  });

  it("fetchPayment divides Razorpay's paise amount by 100 back into rupees", async () => {
    const provider = new RazorpayProvider({
      razorpayKeyId: 'rzp_test_x',
      razorpayKeySecret: 'secret',
    } as never);
    (provider as unknown as { client: unknown }).client = {
      payments: {
        fetch: jest.fn().mockResolvedValue({
          id: 'pay_abc',
          status: 'captured',
          amount: 7130,
          method: 'card',
          error_code: null,
          error_description: null,
        }),
      },
    };

    const result = await provider.fetchPayment('pay_abc');

    expect(result.amount).toBe(71.3);
  });

  it('refund multiplies rupees by 100 before calling the SDK, and passes the reason as a note', async () => {
    const provider = new RazorpayProvider({
      razorpayKeyId: 'rzp_test_x',
      razorpayKeySecret: 'secret',
    } as never);
    const refund = jest.fn().mockResolvedValue({ id: 'rfnd_abc' });
    (provider as unknown as { client: unknown }).client = {
      payments: { refund },
    };

    const result = await provider.refund({
      providerPaymentId: 'pay_abc',
      amount: 40,
      reason: 'requested_by_customer',
    });

    expect(refund).toHaveBeenCalledWith('pay_abc', {
      amount: 4000,
      notes: { reason: 'requested_by_customer' },
    });
    expect(result.providerRefundId).toBe('rfnd_abc');
  });

  it('refund omits the amount entirely for a full refund (no amount given), rather than sending 0', async () => {
    const provider = new RazorpayProvider({
      razorpayKeyId: 'rzp_test_x',
      razorpayKeySecret: 'secret',
    } as never);
    const refund = jest.fn().mockResolvedValue({ id: 'rfnd_abc' });
    (provider as unknown as { client: unknown }).client = {
      payments: { refund },
    };

    await provider.refund({ providerPaymentId: 'pay_abc' });

    expect(refund).toHaveBeenCalledWith('pay_abc', {});
  });
});

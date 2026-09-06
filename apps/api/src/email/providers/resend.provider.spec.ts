import { InternalServerErrorException } from '@nestjs/common';
import { ResendProvider } from './resend.provider';

/**
 * Same reasoning as razorpay.provider.spec.ts: only what's actually ours
 * to test — failing loudly with no key configured (see the class's own
 * doc comment on why the client is constructed lazily), and converting
 * Resend's own `{data: null, error}` response shape into a real thrown
 * exception so callers can use ordinary try/catch. The actual HTTP call
 * to Resend's API is the SDK's own responsibility, not re-tested here —
 * see docs/API_INTEGRATION_STATUS.md for the real sandbox verification
 * this still needs once a real key exists.
 */
describe('ResendProvider — fails loudly with no key configured', () => {
  function makeProvider(overrides: Record<string, unknown> = {}) {
    const config = {
      resendApiKey: undefined,
      resendFromEmail: 'Folia <onboarding@resend.dev>',
      ...overrides,
    };
    return new ResendProvider(config as never);
  }

  it('send throws a clear, specific error rather than an SDK crash when no key is set', async () => {
    const provider = makeProvider();
    await expect(
      provider.send({
        to: 'a@example.com',
        subject: 'x',
        html: '<p>x</p>',
        text: 'x',
      }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      provider.send({
        to: 'a@example.com',
        subject: 'x',
        html: '<p>x</p>',
        text: 'x',
      }),
    ).rejects.toThrow(/RESEND_API_KEY is unset/);
  });
});

describe('ResendProvider — sending with a configured key', () => {
  function makeConfiguredProvider() {
    return new ResendProvider({
      resendApiKey: 'test_key',
      resendFromEmail: 'Folia <onboarding@resend.dev>',
    } as never);
  }

  it('sends with the configured from address and the exact input fields', async () => {
    const provider = makeConfiguredProvider();
    const send = jest
      .fn()
      .mockResolvedValue({ data: { id: 'email_1' }, error: null });
    // Same reasoning as RazorpayProvider's own tests — reaching into the
    // private lazily-constructed client is the only way to intercept the
    // SDK call without mocking the whole `resend` package.
    (provider as unknown as { client: unknown }).client = {
      emails: { send },
    };

    await provider.send({
      to: 'customer@example.com',
      subject: 'Order confirmed',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(send).toHaveBeenCalledWith({
      from: 'Folia <onboarding@resend.dev>',
      to: 'customer@example.com',
      subject: 'Order confirmed',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it("converts Resend's {data: null, error} response into a real thrown exception, not a silent no-op", async () => {
    const provider = makeConfiguredProvider();
    (provider as unknown as { client: unknown }).client = {
      emails: {
        send: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'Invalid `from` field',
            statusCode: 422,
            name: 'validation_error',
          },
        }),
      },
    };

    await expect(
      provider.send({
        to: 'a@example.com',
        subject: 'x',
        html: '<p>x</p>',
        text: 'x',
      }),
    ).rejects.toThrow(/Invalid `from` field/);
  });
});

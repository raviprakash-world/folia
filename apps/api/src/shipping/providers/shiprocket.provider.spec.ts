import { InternalServerErrorException } from '@nestjs/common';
import { ShiprocketProvider } from './shiprocket.provider';

/**
 * Same scope as razorpay.provider.spec.ts: the "fails loudly with no
 * credentials configured" behavior, plus enough of the real login →
 * bearer-token → request flow (mocked fetch) to prove the wiring is
 * self-consistent. The actual Shiprocket API contract (real request/
 * response shapes) is the provider's own responsibility to match — see
 * docs/API_INTEGRATION_STATUS.md for the real sandbox verification this
 * still needs once a Shiprocket account exists.
 */
function makeProvider(overrides: Record<string, unknown> = {}) {
  const config = {
    shiprocketEmail: undefined,
    shiprocketPassword: undefined,
    shiprocketPickupLocation: undefined,
    shiprocketPickupPincode: undefined,
    ...overrides,
  };
  return new ShiprocketProvider(config as never);
}

describe('ShiprocketProvider — fails loudly with no credentials configured', () => {
  it('checkServiceability throws a clear, specific error rather than an unauthenticated request', async () => {
    const provider = makeProvider();
    await expect(
      provider.checkServiceability({
        pickupPincode: '560001',
        deliveryPincode: '110001',
        orderValue: 500,
        isCod: false,
        weightKg: 1,
      }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      provider.checkServiceability({
        pickupPincode: '560001',
        deliveryPincode: '110001',
        orderValue: 500,
        isCod: false,
        weightKg: 1,
      }),
    ).rejects.toThrow(/SHIPROCKET_EMAIL\/SHIPROCKET_PASSWORD are unset/);
  });

  it('createShipment throws the same clear error when unconfigured', async () => {
    const provider = makeProvider();
    await expect(
      provider.createShipment({
        orderId: 'FOL-1',
        orderDate: new Date(),
        shippingAddress: {
          fullName: 'Sam Rivera',
          addressLine1: '123 MG Road',
          city: 'Bengaluru',
          state: 'KA',
          pincode: '560001',
          country: 'India',
          phone: '9999999999',
        },
        items: [{ name: 'Monstera', quantity: 1, unitPrice: 68 }],
        subtotal: 68,
        isCod: false,
        weightKg: 1,
      }),
    ).rejects.toThrow(/SHIPROCKET_EMAIL\/SHIPROCKET_PASSWORD are unset/);
  });

  it('trackShipment throws the same clear error when unconfigured', async () => {
    const provider = makeProvider();
    await expect(provider.trackShipment('AWB123')).rejects.toThrow(
      /SHIPROCKET_EMAIL\/SHIPROCKET_PASSWORD are unset/,
    );
  });
});

describe('ShiprocketProvider — real login → bearer-token → request flow (mocked fetch)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function jsonResponse(body: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('logs in once, caches the token, and sends it as a bearer header on the real request', async () => {
    const fetchMock = jest.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'real-token-1' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [] } }),
      );
    global.fetch = fetchMock as never;

    const provider = makeProvider({
      shiprocketEmail: 'ops@folia.example',
      shiprocketPassword: 'super-secret',
    });

    const result = await provider.checkServiceability({
      pickupPincode: '560001',
      deliveryPincode: '110001',
      orderValue: 500,
      isCod: false,
      weightKg: 1,
    });

    expect(result).toEqual({ serviceable: false, couriers: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(loginUrl).toContain('/auth/login');
    expect(JSON.parse(loginInit.body as string)).toEqual({
      email: 'ops@folia.example',
      password: 'super-secret',
    });
    const [, requestInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((requestInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer real-token-1',
    );
  });

  it('retries exactly once with a fresh login after a 401 (a stale cached token), not in a loop', async () => {
    const fetchMock = jest.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'stale-token' }))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'fresh-token' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [] } }),
      );
    global.fetch = fetchMock as never;

    const provider = makeProvider({
      shiprocketEmail: 'ops@folia.example',
      shiprocketPassword: 'super-secret',
    });

    await provider.checkServiceability({
      pickupPincode: '560001',
      deliveryPincode: '110001',
      orderValue: 500,
      isCod: false,
      weightKg: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const lastCall = fetchMock.mock.calls[3] as [string, RequestInit];
    expect((lastCall[1].headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh-token',
    );
  });

  it('createShipment still fails loudly when SHIPROCKET_PICKUP_LOCATION is unset, even with valid login credentials', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ token: 'real-token' }));
    global.fetch = fetchMock as never;

    const provider = makeProvider({
      shiprocketEmail: 'ops@folia.example',
      shiprocketPassword: 'super-secret',
    });

    await expect(
      provider.createShipment({
        orderId: 'FOL-1',
        orderDate: new Date(),
        shippingAddress: {
          fullName: 'Sam Rivera',
          addressLine1: '123 MG Road',
          city: 'Bengaluru',
          state: 'KA',
          pincode: '560001',
          country: 'India',
          phone: '9999999999',
        },
        items: [{ name: 'Monstera', quantity: 1, unitPrice: 68 }],
        subtotal: 68,
        isCod: false,
        weightKg: 1,
      }),
    ).rejects.toThrow(/SHIPROCKET_PICKUP_LOCATION is unset/);
  });
});

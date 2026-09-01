import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService.process', () => {
  const service = new PaymentsService();
  let randomSpy: jest.SpyInstance;

  afterEach(() => {
    randomSpy?.mockRestore();
  });

  it('succeeds for a card payment when the simulated roll is above the decline threshold', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99); // well above the 0.15 threshold
    const result = service.process('CREDIT_CARD', 'Visa •••• 4242');
    expect(result.method).toBe('CREDIT_CARD');
    expect(result.displayLabel).toBe('Visa •••• 4242');
    expect(result.transactionId).toMatch(/^txn_/);
  });

  it('declines a card payment when the simulated roll falls within the failure rate', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01); // well below the 0.15 threshold
    expect(() => service.process('CREDIT_CARD', 'Visa •••• 4242')).toThrow(
      BadRequestException,
    );
  });

  it('applies the same possible-decline behavior to UPI and Net Banking, not just cards', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(() => service.process('UPI', 'you@bank')).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.process('NET_BANKING', 'Cascade Community Bank'),
    ).toThrow(BadRequestException);
  });

  it('never declines Cash on Delivery, even on the worst possible random roll', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(() => service.process('COD', 'Pay on delivery')).not.toThrow();
  });

  it('never declines Wallet, even on the worst possible random roll', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(() => service.process('WALLET', 'Folia Wallet')).not.toThrow();
  });

  it("generates a distinct transaction id on every successful call (real randomness, not mocked, since mocking Math.random would also fix the id generator's own randomness)", () => {
    const first = service.process('COD', 'x');
    const second = service.process('COD', 'x');
    expect(first.transactionId).not.toBe(second.transactionId);
  });
});

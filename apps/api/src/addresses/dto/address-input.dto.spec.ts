import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddressInputDto } from './address-input.dto';

/**
 * P0-F — India-commerce correctness. Before this, postalCode/country/
 * phone were unvalidated free strings, so an address that would fail
 * downstream at ShiprocketProvider (which requires a real Indian PIN)
 * passed this DTO layer silently.
 */
const validAddress = {
  fullName: 'Priya Sharma',
  phone: '9876543210',
  addressLine1: '221B, MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'IN',
  postalCode: '560001',
  type: 'home' as const,
};

describe('AddressInputDto', () => {
  it('accepts a valid Indian address', async () => {
    const dto = plainToInstance(AddressInputDto, validAddress);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a postal code that is not a 6-digit Indian PIN', async () => {
    const dto = plainToInstance(AddressInputDto, {
      ...validAddress,
      postalCode: '97201', // 5-digit US ZIP shape
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'postalCode')).toBe(true);
  });

  it('rejects a PIN code starting with 0 — not a real India Post zone', async () => {
    const dto = plainToInstance(AddressInputDto, {
      ...validAddress,
      postalCode: '012345',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'postalCode')).toBe(true);
  });

  it('rejects a non-Indian country', async () => {
    const dto = plainToInstance(AddressInputDto, {
      ...validAddress,
      country: 'US',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('rejects a non-Indian phone number', async () => {
    const dto = plainToInstance(AddressInputDto, {
      ...validAddress,
      phone: '+14155552671',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});

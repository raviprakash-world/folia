import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApplySellerDto } from './apply-seller.dto';

const base = {
  displayName: 'Demo Nursery',
  description: 'A fictional demo storefront used only in tests.',
  contactEmail: 'hello@demo-nursery.example',
  contactPhone: '9876543210',
  address: {
    addressLine1: '12 Demo Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'IN',
    postalCode: '560001',
  },
};

async function errorsFor(overrides: Record<string, unknown>) {
  const dto = plainToInstance(ApplySellerDto, { ...base, ...overrides });
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('ApplySellerDto — the contract the seller forms must satisfy', () => {
  it('accepts an application with no GSTIN (not every seller is GST-registered)', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it('accepts a shape- and checksum-valid GSTIN', async () => {
    expect(await errorsFor({ gstin: '27AAPFU0939F1ZV' })).toEqual([]);
  });

  it('rejects a well-shaped GSTIN with a bad checksum', async () => {
    expect(await errorsFor({ gstin: '27AAPFU0939F1ZA' })).toEqual(['gstin']);
  });

  it('rejects an empty-string GSTIN — forms must omit the field instead of sending ""', async () => {
    expect(await errorsFor({ gstin: '' })).toEqual(['gstin']);
  });

  it('rejects a business address whose country is not the ISO code "IN"', async () => {
    expect(
      await errorsFor({ address: { ...base.address, country: 'India' } }),
    ).toEqual(['address']);
  });

  it('rejects a postal code that is not a valid 6-digit PIN', async () => {
    expect(
      await errorsFor({ address: { ...base.address, postalCode: '012345' } }),
    ).toEqual(['address']);
  });
});

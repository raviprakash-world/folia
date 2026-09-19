import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEnquiryDto } from './create-enquiry.dto';

const valid = {
  type: 'CORPORATE_GIFTING',
  name: 'Asha',
  email: 'asha@example.com',
  message: 'We need 100 desk plants for Diwali.',
  quantity: '100',
  neededBy: '2026-11-01',
};

async function errorsFor(input: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateEnquiryDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('CreateEnquiryDto', () => {
  it('accepts a complete corporate-gifting enquiry (quantity arrives as a string)', async () => {
    expect(await errorsFor(valid)).toEqual([]);
  });

  it('rejects an unknown type, a bad phone, a bad date, a short message and stray fields', async () => {
    expect(await errorsFor({ ...valid, type: 'SPAM' })).toContain('type');
    expect(await errorsFor({ ...valid, phone: 'abc' })).toContain('phone');
    expect(await errorsFor({ ...valid, neededBy: '01/11/2026' })).toContain(
      'neededBy',
    );
    expect(await errorsFor({ ...valid, message: 'hi' })).toContain('message');
    expect(await errorsFor({ ...valid, status: 'HANDLED' })).toContain(
      'status',
    );
  });

  it('rejects a zero or absurd quantity', async () => {
    expect(await errorsFor({ ...valid, quantity: '0' })).toContain('quantity');
    expect(await errorsFor({ ...valid, quantity: '9999999' })).toContain(
      'quantity',
    );
  });
});

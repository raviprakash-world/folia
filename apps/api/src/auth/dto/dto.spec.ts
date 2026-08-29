import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { ChangePasswordDto } from './change-password.dto';

const validRegister = {
  firstName: 'Sam',
  lastName: 'Rivera',
  email: 'sam@example.com',
  password: 'Correct1Horse',
};

describe('RegisterDto', () => {
  it('accepts a valid registration payload', async () => {
    const dto = plainToInstance(RegisterDto, validRegister);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a password without an uppercase letter', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegister,
      password: 'correct1horse',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password without a digit', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegister,
      password: 'CorrectHorse',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password under 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegister,
      password: 'Aa1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegister,
      email: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing firstName', async () => {
    const { firstName: _omit, ...rest } = validRegister;
    const dto = plainToInstance(RegisterDto, rest);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('accepts a valid optional phone number and rejects an invalid one', async () => {
    const withGoodPhone = plainToInstance(RegisterDto, {
      ...validRegister,
      phone: '+14155552671',
    });
    expect(await validate(withGoodPhone)).toHaveLength(0);

    const withBadPhone = plainToInstance(RegisterDto, {
      ...validRegister,
      phone: 'not-a-phone',
    });
    const errors = await validate(withBadPhone);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});

describe('LoginDto', () => {
  it('accepts a minimal valid login payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'demo@folia.example',
      password: 'anything',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('does not apply password strength rules to login (only to new passwords)', async () => {
    // Login must accept an existing (possibly weak, pre-policy) password —
    // strength rules only apply when a password is being *created*.
    const dto = plainToInstance(LoginDto, {
      email: 'demo@folia.example',
      password: 'short',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'demo@folia.example',
      password: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});

describe('ResetPasswordDto and ChangePasswordDto', () => {
  it('ResetPasswordDto enforces the same strong-password rule as registration', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'raw-token',
      password: 'weak',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('ChangePasswordDto enforces the strong-password rule on newPassword only', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'whatever-it-was',
      newPassword: 'Correct1New',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

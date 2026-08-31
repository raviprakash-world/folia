import { Matches, MaxLength, MinLength } from 'class-validator';

// Matches apps/web/src/utils/validation.ts's PASSWORD_REGEX exactly.
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export function IsStrongPassword() {
  return function (target: object, propertyKey: string) {
    MinLength(8, { message: 'Password must be at least 8 characters' })(
      target,
      propertyKey,
    );
    MaxLength(128, { message: 'Password must be under 128 characters' })(
      target,
      propertyKey,
    );
    Matches(PASSWORD_REGEX, {
      message: 'Password needs an uppercase letter and a number',
    })(target, propertyKey);
  };
}

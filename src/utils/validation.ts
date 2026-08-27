import { z } from 'zod';
import { isValidPostalCode } from '@/utils/region';

export const newsletterSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
});

export type NewsletterFormValues = z.infer<typeof newsletterSchema>;

// Pragmatic phone check — allows +, spaces, dashes, parens, 7-15 digits.
// Not full E.164 validation, which needs a real phone-number library.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

export const contactSchema = z.object({
  name: z.string().min(1, 'Enter your name').max(80),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: z.string().min(1, 'Enter a phone number').regex(PHONE_REGEX, 'Enter a valid phone number'),
  subject: z.string().min(1, 'Enter a subject').max(120),
  message: z.string().min(10, 'Message needs at least 10 characters').max(2000),
});

export type ContactFormValues = z.infer<typeof contactSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// Practical strength rule: 8+ chars, at least one uppercase letter, one number.
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'Enter your first name').max(60),
    lastName: z.string().min(1, 'Enter your last name').max(60),
    email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(PASSWORD_REGEX, 'Needs an uppercase letter and a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const passwordFieldsSchema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(PASSWORD_REGEX, 'Needs an uppercase letter and a number'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
});

function passwordsMatch(data: { password: string; confirmPassword: string }) {
  return data.password === data.confirmPassword;
}

export const resetPasswordSchema = passwordFieldsSchema.refine(passwordsMatch, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Same password rules as resetPasswordSchema, plus the one field specific to
// an authenticated change: the current password. Built from the shared base
// schema above rather than duplicating the password/confirm rules.
export const changePasswordSchema = passwordFieldsSchema
  .extend({ currentPassword: z.string().min(1, 'Enter your current password') })
  .refine(passwordsMatch, { message: "Passwords don't match", path: ['confirmPassword'] });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// --- Address book (Phase 6) ---

export const addressSchema = z
  .object({
    fullName: z.string().min(1, 'Enter a full name').max(80),
    phone: z.string().min(1, 'Enter a phone number').regex(PHONE_REGEX, 'Enter a valid phone number'),
    email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
    addressLine1: z.string().min(1, 'Enter an address').max(120),
    addressLine2: z.string().max(120).optional().or(z.literal('')),
    landmark: z.string().max(120).optional().or(z.literal('')),
    city: z.string().min(1, 'Enter a city').max(60),
    state: z.string().min(1, 'Enter a state or province').max(60),
    country: z.string().min(1, 'Select a country'),
    postalCode: z.string().min(1, 'Enter a postal code'),
    type: z.enum(['home', 'office', 'other']),
    label: z.string().max(40).optional().or(z.literal('')),
    isDefaultShipping: z.boolean(),
    isDefaultBilling: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!isValidPostalCode(data.postalCode, data.country)) {
      ctx.addIssue({
        code: 'custom',
        path: ['postalCode'],
        message: 'That postal code doesn\u2019t look right for the selected country.',
      });
    }
  });

export type AddressFormValues = z.infer<typeof addressSchema>;

// --- Payment (Phase 6) ---

// Digits only, spaces stripped before validation, 13-19 digits covers
// real-world card number lengths without a full Luhn-check dependency.
const CARD_NUMBER_REGEX = /^\d{13,19}$/;
const EXPIRY_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;
const CVV_REGEX = /^\d{3,4}$/;

export const cardPaymentSchema = z.object({
  cardholderName: z.string().min(1, 'Enter the name on the card').max(80),
  cardNumber: z
    .string()
    .min(1, 'Enter a card number')
    .transform((v) => v.replace(/\s+/g, ''))
    .refine((v) => CARD_NUMBER_REGEX.test(v), 'Enter a valid card number'),
  expiry: z.string().min(1, 'Enter the expiry date').regex(EXPIRY_REGEX, 'Use MM/YY format'),
  cvv: z.string().min(1, 'Enter the CVV').regex(CVV_REGEX, '3 or 4 digits'),
});

export type CardPaymentFormValues = z.infer<typeof cardPaymentSchema>;

export const savedCardCvvSchema = z.object({ cvv: cardPaymentSchema.shape.cvv });
export type SavedCardCvvFormValues = z.infer<typeof savedCardCvvSchema>;

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

export const upiPaymentSchema = z.object({
  upiId: z.string().min(1, 'Enter your UPI ID').regex(UPI_REGEX, 'Enter a valid UPI ID (e.g. name@bank)'),
});

export type UpiPaymentFormValues = z.infer<typeof upiPaymentSchema>;

export const netBankingSchema = z.object({
  bank: z.string().min(1, 'Select your bank'),
});

export type NetBankingFormValues = z.infer<typeof netBankingSchema>;

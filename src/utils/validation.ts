import { z } from 'zod';

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

export const resetPasswordSchema = z
  .object({
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

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

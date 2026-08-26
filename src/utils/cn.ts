/**
 * Merges class name fragments, dropping falsy values.
 * Deliberately lightweight — no clsx/tailwind-merge dependency for something this small.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

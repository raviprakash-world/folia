import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as not requiring authentication — JwtAuthGuard (applied globally via APP_GUARD) checks for this and skips validation. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

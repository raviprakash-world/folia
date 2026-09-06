/**
 * Kept in its own file, deliberately — jobs.module.ts previously defined
 * and exported this constant itself, while also importing the processor
 * that needed to import it back. That's a real circular import between
 * the two files, and it caused a genuine bug: at the moment the
 * @Processor()/@InjectQueue() decorators actually ran, the circular
 * import meant this constant hadn't finished being assigned yet, so
 * both decorators silently received `undefined` instead of the real
 * queue name — which is why NestJS reported it couldn't find a queue
 * called "default" (@InjectQueue(undefined) falls back to the default
 * queue name) rather than "release-expired-reservations". Same fix
 * already applied for the same reason in analytics/analytics.events.ts
 * (Phase 8) — not applied here originally, which was the mistake.
 */
export const RELEASE_EXPIRED_RESERVATIONS_QUEUE =
  'release-expired-reservations';

/** Same circular-import reasoning as the constant above — kept in this file, not jobs.module.ts, for the same reason. */
export const EXPIRE_STALE_PAYMENTS_QUEUE = 'expire-stale-payments';

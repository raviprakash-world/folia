// See users/user.types.ts's top-of-file comment for why these are hand-written.
export type NotificationType =
  'ORDER' | 'SHIPPING' | 'PROMOTION' | 'WISHLIST' | 'ACCOUNT' | 'SECURITY';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: Date;
}

/** Matches apps/web/src/types/notification.ts's Notification shape — type lowercased to match the frontend's own lowercase union, everything else field-for-field. No archived field — see the Prisma schema's own doc comment for why. */
export function toPublicNotification(n: NotificationRecord) {
  return {
    id: n.id,
    type: n.type.toLowerCase() as Lowercase<NotificationType>,
    title: n.title,
    message: n.message,
    href: n.href ?? undefined,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

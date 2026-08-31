export type NotificationType = 'order' | 'shipping' | 'promotion' | 'wishlist' | 'account' | 'security';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  archived: boolean;
  /** Optional in-app destination — e.g. an order detail page. */
  href?: string;
}

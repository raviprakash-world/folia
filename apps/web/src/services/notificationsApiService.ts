import { apiClient } from './apiClient';
import type { NotificationType } from '@/types/notification';

/** Matches the real backend's response exactly (toPublicNotification, Phase 15) — no archived field, a stated scope cut (see store/archivedNotificationsStore.ts's doc comment for why). */
interface RealNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

interface RealNotificationsResponse {
  items: RealNotification[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchRealNotifications(): Promise<RealNotification[]> {
  const { data } = await apiClient.get<RealNotificationsResponse>('/notifications', {
    params: { pageSize: 50 },
  });
  return data.items;
}

export async function fetchRealUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markRealNotificationAsRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllRealNotificationsAsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

export async function deleteRealNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}

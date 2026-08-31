import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('create() writes the exact fields given, defaulting href to null when omitted', async () => {
    const prisma = {
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new NotificationsService(prisma as never);

    await service.create({
      userId: 'user-1',
      type: 'ORDER',
      title: 'Order Placed',
      message: 'msg',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'ORDER',
        title: 'Order Placed',
        message: 'msg',
        href: null,
      },
    });
  });

  it('findAllForUser scopes to the given user, orders newest-first, and paginates', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new NotificationsService(prisma as never);

    await service.findAllForUser('user-1', 2, 10);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });

  it('findAllForUser clamps pageSize to the real maximum, never trusting the caller-supplied value directly', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new NotificationsService(prisma as never);

    await service.findAllForUser('user-1', 1, 9999);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("getUnreadCount counts only this user's unread notifications", async () => {
    const prisma = { notification: { count: jest.fn().mockResolvedValue(3) } };
    const service = new NotificationsService(prisma as never);

    await expect(service.getUnreadCount('user-1')).resolves.toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
    });
  });

  it("markAsRead scopes the update to {id, userId} — can never touch another user's notification", async () => {
    const prisma = {
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new NotificationsService(prisma as never);

    await service.markAsRead('user-1', 'notif-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'user-1' },
      data: { read: true },
    });
  });

  it('markAsRead throws NotFoundException — a real error, not a silent no-op — when the notification belongs to someone else', async () => {
    const prisma = {
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new NotificationsService(prisma as never);

    await expect(
      service.markAsRead('user-1', 'someone-elses-notif'),
    ).rejects.toThrow(NotFoundException);
  });

  it('markAllAsRead scopes to the given user and only unread rows', async () => {
    const prisma = {
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new NotificationsService(prisma as never);

    await service.markAllAsRead('user-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
      data: { read: true },
    });
  });

  it("remove scopes deletion to {id, userId} — never touches another user's notification", async () => {
    const prisma = {
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new NotificationsService(prisma as never);

    await service.remove('user-1', 'notif-1');

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'user-1' },
    });
  });

  it('remove throws NotFoundException — a real error, not a silent no-op — when the notification belongs to someone else', async () => {
    const prisma = {
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new NotificationsService(prisma as never);

    await expect(
      service.remove('user-1', 'someone-elses-notif'),
    ).rejects.toThrow(NotFoundException);
  });
});

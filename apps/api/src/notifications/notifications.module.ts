import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './notification-event.listener';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}

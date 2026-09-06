import { Module } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.interface';
import { ResendProvider } from './providers/resend.provider';
import { EmailEventListener } from './email-event.listener';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    { provide: EMAIL_SERVICE, useClass: ResendProvider },
    EmailEventListener,
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}

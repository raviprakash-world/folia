import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { SessionsModule } from '../sessions/sessions.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [SessionsModule, RolesModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

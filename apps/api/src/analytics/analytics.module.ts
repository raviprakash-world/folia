import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventListener } from './analytics-event.listener';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsEventListener],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

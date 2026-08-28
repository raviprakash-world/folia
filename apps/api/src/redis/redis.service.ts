import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(config: AppConfigService) {
    super(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }

  async onModuleInit() {
    await this.connect();
    this.logger.log('Connected to Redis');
  }

  onModuleDestroy() {
    this.disconnect();
  }
}

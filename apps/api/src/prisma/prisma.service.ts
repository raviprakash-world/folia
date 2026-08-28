import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

/**
 * KNOWN ENVIRONMENT-SPECIFIC LINT SUPPRESSION (not a code defect):
 * Until `npm run prisma:generate` has been run at least once,
 * @prisma/client's pre-generation stub types `PrismaClient` as `any`
 * (node_modules/.prisma/client/default.d.ts). That makes every call
 * into it — including the base `super()`/`$connect()`/`$disconnect()`
 * methods used below, which are always safe regardless of the generated
 * schema — look like unsafe `any` calls to eslint. These three
 * eslint-disable comments become unnecessary (and should be removed) once
 * `prisma generate` has run in an environment with access to
 * binaries.prisma.sh; see ARCHITECTURE.md's "Known issues" for why that
 * command cannot be run in the sandbox this Phase 0 delivery was built in.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      datasources: { db: { url: config.databaseUrl } },
      log: config.isProduction ? ['warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  async onModuleDestroy() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.$disconnect();
  }
}

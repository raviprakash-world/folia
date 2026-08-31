/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-redundant-type-constituents */
// See users/users.service.ts's top-of-file comment for why this exemption exists. Widened (Phase 13, real prisma generate) to also cover no-unsafe-assignment/no-redundant-type-constituents — Prisma.InputJsonValue doesn't exist in this sandbox's minimal pre-generation stub, a real, correctly-named export once real generation succeeds.
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LogAuditInput } from './audit.types';

const SENSITIVE_METADATA_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'cardnumber',
  'cvv',
];

/**
 * Same "never let logging fail the real request" contract as
 * AnalyticsService (Phase 8), for the same reason. The one real
 * difference: audit metadata is scrubbed of anything that looks like a
 * secret before it's ever written, not just relying on callers to be
 * careful — a defense-in-depth measure specifically because audit logs
 * (unlike analytics events) often get attached directly to the action
 * that changed something, which is exactly the kind of call site where a
 * password or token could accidentally end up in a metadata blob.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private scrub(
    metadata: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!metadata) return metadata;
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      clean[key] = SENSITIVE_METADATA_KEYS.some((sensitive) =>
        lowerKey.includes(sensitive),
      )
        ? '[redacted]'
        : value;
    }
    return clean;
  }

  async log(input: LogAuditInput): Promise<void> {
    try {
      const scrubbedMetadata = this.scrub(input.metadata) as
        Prisma.InputJsonValue | undefined;
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          metadata: scrubbedMetadata,
          ipAddress: input.ipAddress,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log (action=${input.action}, resource=${input.resource}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async findForResource(resource: string, resourceId: string) {
    return await this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

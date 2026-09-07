/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { WarehouseRecord } from '../inventory/inventory.types';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<WarehouseRecord[]> {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    }) as Promise<WarehouseRecord[]>;
  }

  async findByCodeOrThrow(code: string): Promise<WarehouseRecord> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { code },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse as WarehouseRecord;
  }

  /**
   * Marketplace Phase 3 — used wherever a caller needs "the" warehouse
   * without asking a customer/seller to pick one (a seller's new
   * product's initial stock has to go somewhere). Throws if none has
   * been seeded/marked default — a real configuration error, not a
   * normal runtime state, mirroring RolesService.getDefaultRoleOrThrow's
   * exact shape.
   */
  async getDefaultOrThrow(): Promise<WarehouseRecord> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { isDefault: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        'No default warehouse is configured — seed one with isDefault: true.',
      );
    }
    return warehouse;
  }

  async create(input: {
    code: string;
    name: string;
    isDefault?: boolean;
  }): Promise<WarehouseRecord> {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: input.code },
    });
    if (existing)
      throw new ConflictException(
        `A warehouse with code "${input.code}" already exists.`,
      );

    // Real invariant, not just a comment: at most one warehouse is ever
    // default. If this one is being created as the default, clear the
    // flag on every other warehouse first, in the same transaction.
    if (input.isDefault) {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.warehouse.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
          return tx.warehouse.create({ data: input });
        },
      );
    }
    return this.prisma.warehouse.create({
      data: input,
    }) as Promise<WarehouseRecord>;
  }
}

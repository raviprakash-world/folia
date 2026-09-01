/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slotToDb, typeToDb } from './address.types';
import type { AddressRecord } from './address.types';
import type { AddressInputDto } from './dto/address-input.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<AddressRecord[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }) as Promise<AddressRecord[]>;
  }

  /** Same ownership-verification pattern as update()/remove() — never returns an address belonging to a different user, even for a valid id. */
  async findOwnedOrThrow(userId: string, id: string): Promise<AddressRecord> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address || (address as AddressRecord).userId !== userId) {
      throw new NotFoundException('Address not found.');
    }
    return address as AddressRecord;
  }

  /** Mirrors apps/web/src/mocks/addressHandlers.ts's applyDefaultExclusivity exactly — clearing the flag on every other address for this user, in the same transaction as the write that set it. */
  private async applyDefaultExclusivity(
    tx: Prisma.TransactionClient,
    userId: string,
    changedAddressId: string,
    field: 'isDefaultShipping' | 'isDefaultBilling',
  ) {
    await tx.address.updateMany({
      where: { userId, id: { not: changedAddressId }, [field]: true },
      data: { [field]: false },
    });
  }

  async create(userId: string, dto: AddressInputDto): Promise<AddressRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const created = await tx.address.create({
          data: {
            userId,
            fullName: dto.fullName,
            phone: dto.phone,
            alternatePhone: dto.alternatePhone,
            email: dto.email,
            companyName: dto.companyName,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            landmark: dto.landmark,
            deliveryInstructions: dto.deliveryInstructions,
            city: dto.city,
            state: dto.state,
            country: dto.country,
            postalCode: dto.postalCode,
            type: typeToDb(dto.type),
            label: dto.label,
            preferredTimeSlot: slotToDb(dto.preferredTimeSlot),
            isDefaultShipping: dto.isDefaultShipping ?? false,
            isDefaultBilling: dto.isDefaultBilling ?? false,
          },
        });

        // Extracted to a typed local (rather than passing created.id
        // directly) specifically so the pre-generation `any` from
        // Prisma.TransactionClient (see PrismaService's own doc comment)
        // doesn't need an inline eslint-disable on a multi-line call —
        // this resolves cleanly once real generation succeeds either way.
        const createdId: string = created.id;
        if (created.isDefaultShipping) {
          await this.applyDefaultExclusivity(
            tx,
            userId,
            createdId,
            'isDefaultShipping',
          );
        }
        if (created.isDefaultBilling) {
          await this.applyDefaultExclusivity(
            tx,
            userId,
            createdId,
            'isDefaultBilling',
          );
        }
        return created;
      },
    );
  }

  async update(
    userId: string,
    id: string,
    dto: AddressInputDto,
  ): Promise<AddressRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Address has no (id, userId) compound unique constraint, so
        // ownership must be checked explicitly before mutating — a
        // `where: { id, userId }` on update()/delete() is not valid Prisma
        // syntax for a non-unique combination and risks Prisma silently
        // falling back to matching by `id` alone, which would let any
        // authenticated user modify another user's address by guessing its
        // id. This existed as a real bug here briefly before being caught
        // and fixed with this explicit check.
        const existing = await tx.address.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) {
          throw new NotFoundException('Address not found.');
        }

        const updated = await tx.address.update({
          where: { id },
          data: {
            fullName: dto.fullName,
            phone: dto.phone,
            alternatePhone: dto.alternatePhone,
            email: dto.email,
            companyName: dto.companyName,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            landmark: dto.landmark,
            deliveryInstructions: dto.deliveryInstructions,
            city: dto.city,
            state: dto.state,
            country: dto.country,
            postalCode: dto.postalCode,
            type: typeToDb(dto.type),
            label: dto.label,
            preferredTimeSlot: slotToDb(dto.preferredTimeSlot),
            isDefaultShipping: dto.isDefaultShipping ?? false,
            isDefaultBilling: dto.isDefaultBilling ?? false,
          },
        });

        if (updated.isDefaultShipping)
          await this.applyDefaultExclusivity(
            tx,
            userId,
            id,
            'isDefaultShipping',
          );
        if (updated.isDefaultBilling)
          await this.applyDefaultExclusivity(
            tx,
            userId,
            id,
            'isDefaultBilling',
          );
        return updated;
      },
    );
  }

  /**
   * Mirrors the mock handler's delete-auto-promotion exactly: if the
   * deleted address was a default, the first remaining address (for this
   * user) is promoted so the address book is never silently defaultless.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Same reasoning as update() above — explicit ownership check
      // before mutating, not a combined where clause on non-unique fields.
      const existing = await tx.address.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        throw new NotFoundException('Address not found.');
      }

      const deleted = await tx.address.delete({ where: { id } });

      if (!deleted.isDefaultShipping && !deleted.isDefaultBilling) return;

      const remaining = await tx.address.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 1,
      });
      const first = remaining[0];
      if (!first) return;

      await tx.address.update({
        where: { id: first.id },
        data: {
          isDefaultShipping: deleted.isDefaultShipping
            ? true
            : first.isDefaultShipping,
          isDefaultBilling: deleted.isDefaultBilling
            ? true
            : first.isDefaultBilling,
        },
      });
    });
  }
}

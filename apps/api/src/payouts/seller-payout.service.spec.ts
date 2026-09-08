/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Same reasoning as payments.service.spec.ts's top-of-file comment (member
// access) and cart.service.spec.ts's (assignment) — untyped jest mocks and
// expect.any()/expect.objectContaining() are both typed `any`.
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SellerPayoutService } from './seller-payout.service';
import type { LogAuditInput } from '../audit/audit.types';

function ledgerEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    sellerId: 'seller-a',
    type: 'SALE',
    amount: 100,
    ...overrides,
  };
}

function payoutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payout-1',
    sellerId: 'seller-a',
    status: 'PENDING',
    amount: 100,
    idempotencyKey: 'key-1',
    failureReason: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDeps() {
  const tx = {
    sellerLedgerEntry: { findMany: jest.fn() },
    sellerPayout: { create: jest.fn() },
    sellerPayoutItem: { createMany: jest.fn() },
  };
  const prisma = {
    seller: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    sellerPayout: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    sellerPayoutItem: { deleteMany: jest.fn() },
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const auditService = {
    log: jest.fn<Promise<void>, [LogAuditInput]>().mockResolvedValue(undefined),
  };
  const ledgerService = {
    recordPayout: jest.fn().mockResolvedValue(undefined),
  };
  const eventEmitter = { emit: jest.fn() };
  const service = new SellerPayoutService(
    prisma as never,
    auditService as never,
    ledgerService as never,
    eventEmitter,
  );
  return { tx, prisma, auditService, ledgerService, eventEmitter, service };
}

describe('SellerPayoutService.adminInitiatePayout', () => {
  it('claims every currently-unclaimed non-PAYOUT entry into a new PENDING payout, amount = their sum', async () => {
    const { tx, prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    tx.sellerLedgerEntry.findMany.mockResolvedValue([
      ledgerEntry({ id: 'e1', type: 'SALE', amount: 100 }),
      ledgerEntry({ id: 'e2', type: 'COMMISSION', amount: -10 }),
    ]);
    tx.sellerPayout.create.mockResolvedValue(
      payoutRow({ id: 'payout-new', amount: 90 }),
    );

    const payout = await service.adminInitiatePayout('admin-1', 'seller-a');

    expect(tx.sellerLedgerEntry.findMany).toHaveBeenCalledWith({
      where: {
        sellerId: 'seller-a',
        type: { not: 'PAYOUT' },
        payoutItem: null,
      },
    });
    expect(tx.sellerPayout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: 'seller-a',
        status: 'PENDING',
        amount: 90,
      }),
    });
    expect(tx.sellerPayoutItem.createMany).toHaveBeenCalledWith({
      data: [
        { payoutId: 'payout-new', ledgerEntryId: 'e1' },
        { payoutId: 'payout-new', ledgerEntryId: 'e2' },
      ],
    });
    expect(payout.id).toBe('payout-new');
  });

  it('generates a server-side idempotency key when the caller supplies none', async () => {
    const { tx, prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    tx.sellerLedgerEntry.findMany.mockResolvedValue([ledgerEntry()]);
    tx.sellerPayout.create.mockResolvedValue(payoutRow());

    await service.adminInitiatePayout('admin-1', 'seller-a');

    const createCall = tx.sellerPayout.create.mock.calls[0][0] as {
      data: { idempotencyKey: string };
    };
    expect(createCall.data.idempotencyKey).toEqual(expect.any(String));
    expect(createCall.data.idempotencyKey.length).toBeGreaterThan(10);
  });

  it('uses the caller-supplied idempotency key when one is given', async () => {
    const { tx, prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    tx.sellerLedgerEntry.findMany.mockResolvedValue([ledgerEntry()]);
    tx.sellerPayout.create.mockResolvedValue(payoutRow());

    await service.adminInitiatePayout('admin-1', 'seller-a', 'my-key');

    expect(tx.sellerPayout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: 'my-key' }),
      }),
    );
  });

  it('rejects when there is nothing unclaimed to pay out (balance exactly 0)', async () => {
    const { tx, prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    tx.sellerLedgerEntry.findMany.mockResolvedValue([]);

    await expect(
      service.adminInitiatePayout('admin-1', 'seller-a'),
    ).rejects.toThrow(BadRequestException);
    expect(tx.sellerPayout.create).not.toHaveBeenCalled();
  });

  it('rejects when the unclaimed balance is negative', async () => {
    const { tx, prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    tx.sellerLedgerEntry.findMany.mockResolvedValue([
      ledgerEntry({ type: 'COMMISSION', amount: -5 }),
    ]);

    await expect(
      service.adminInitiatePayout('admin-1', 'seller-a'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects for a seller that does not exist, before ever opening the claiming transaction', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.adminInitiatePayout('admin-1', 'nonexistent'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('converts a P2002 unique-constraint violation (two concurrent initiations truly interleaved and both tried to claim the same entry) into a clean 409, not a raw 500', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    prisma.$transaction.mockImplementation(() =>
      Promise.reject(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['ledgerEntryId'] },
        }),
      ),
    );

    await expect(
      service.adminInitiatePayout('admin-1', 'seller-a'),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates a genuinely unrelated database error as-is, rather than mislabeling it a claim race', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    prisma.$transaction.mockImplementation(() =>
      Promise.reject(new Error('connection refused')),
    );

    await expect(
      service.adminInitiatePayout('admin-1', 'seller-a'),
    ).rejects.toThrow('connection refused');
  });
});

describe('SellerPayoutService transitions', () => {
  it('adminMarkProcessing moves PENDING -> PROCESSING and audits it', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 1 });
    prisma.sellerPayout.findUniqueOrThrow.mockResolvedValue(
      payoutRow({ status: 'PROCESSING' }),
    );

    const result = await service.adminMarkProcessing('admin-1', 'payout-1');

    expect(prisma.sellerPayout.updateMany).toHaveBeenCalledWith({
      where: { id: 'payout-1', status: { in: ['PENDING'] } },
      data: { status: 'PROCESSING' },
    });
    expect(result.status).toBe('PROCESSING');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SELLER_PAYOUT_PROCESSING' }),
    );
  });

  it('adminMarkPaid moves PROCESSING -> PAID, writes the offsetting ledger entry, and emits the notification event', async () => {
    const { prisma, ledgerService, eventEmitter, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 1 });
    prisma.sellerPayout.findUniqueOrThrow.mockResolvedValue(
      payoutRow({ status: 'PAID', amount: 90 }),
    );
    prisma.seller.findUniqueOrThrow.mockResolvedValue({
      id: 'seller-a',
      userId: 'user-a',
    });

    const result = await service.adminMarkPaid('admin-1', 'payout-1');

    expect(result.status).toBe('PAID');
    expect(ledgerService.recordPayout).toHaveBeenCalledWith(
      'seller-a',
      'payout-1',
      90,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.seller_payout_paid',
      expect.objectContaining({
        sellerId: 'seller-a',
        userId: 'user-a',
        payoutId: 'payout-1',
        amount: 90,
      }),
    );
  });

  it('adminMarkFailed releases the claimed ledger entries (deletes the SellerPayoutItem rows) so a future payout can claim them again', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 1 });
    prisma.sellerPayout.findUniqueOrThrow.mockResolvedValue(
      payoutRow({ status: 'FAILED', failureReason: 'bank rejected transfer' }),
    );

    await service.adminMarkFailed(
      'admin-1',
      'payout-1',
      'bank rejected transfer',
    );

    expect(prisma.sellerPayoutItem.deleteMany).toHaveBeenCalledWith({
      where: { payoutId: 'payout-1' },
    });
  });

  it('adminCancel releases the claim too, under its own distinct audit action', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 1 });
    prisma.sellerPayout.findUniqueOrThrow.mockResolvedValue(
      payoutRow({ status: 'CANCELLED' }),
    );

    await service.adminCancel('admin-1', 'payout-1');

    expect(prisma.sellerPayoutItem.deleteMany).toHaveBeenCalledWith({
      where: { payoutId: 'payout-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SELLER_PAYOUT_CANCELLED' }),
    );
  });

  it('rejects an invalid transition (e.g. mark-paid on a PENDING payout) with ConflictException, naming the actual current status', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 0 });
    prisma.sellerPayout.findUnique.mockResolvedValue(
      payoutRow({ status: 'PENDING' }),
    );

    await expect(service.adminMarkPaid('admin-1', 'payout-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws NotFoundException for an unknown payout id', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerPayout.updateMany.mockResolvedValue({ count: 0 });
    prisma.sellerPayout.findUnique.mockResolvedValue(null);

    await expect(
      service.adminMarkProcessing('admin-1', 'nonexistent'),
    ).rejects.toThrow(NotFoundException);
  });
});

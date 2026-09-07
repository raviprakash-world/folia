import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SellersService } from './sellers.service';
import type { VerificationFileLike } from './seller-verification-file.util';

function pdfBuffer(): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.4', 'latin1'), Buffer.alloc(100)]);
}

function verificationFile(
  overrides: Partial<VerificationFileLike> = {},
): VerificationFileLike {
  const buffer = overrides.buffer ?? pdfBuffer();
  return {
    originalname: 'business-registration.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

function makeSellerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seller-1',
    userId: 'user-1',
    slug: 'test-seller-abc123',
    displayName: 'Test Seller',
    description: 'A seller for tests',
    logoUrl: null,
    contactEmail: 'seller@example.com',
    contactPhone: '+91 90000 00000',
    status: 'APPLIED',
    appliedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    rejectionNote: null,
    suspendedAt: null,
    deactivatedAt: null,
    statusNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    address: null,
    verifications: [],
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    seller: {
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      findUniqueOrThrow: jest.fn<Promise<unknown>, [unknown]>(),
      findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
      create: jest.fn<Promise<unknown>, [unknown]>(),
      update: jest.fn<Promise<unknown>, [{ data: Record<string, unknown> }]>(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [{ where: Record<string, unknown>; data: Record<string, unknown> }]
      >(),
      count: jest.fn<Promise<number>, [unknown]>(),
    },
    sellerVerification: {
      findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
      create: jest.fn<Promise<unknown>, [unknown]>(),
    },
    product: {
      aggregate: jest.fn<Promise<unknown>, [unknown]>(),
    },
    user: {
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    $transaction: jest.fn<Promise<unknown>, [unknown]>(),
  };
  // Default: a bare passthrough for array-of-promises $transaction calls
  // (adminList) and callback-style calls (apply) — each test overrides
  // the specific behavior it needs.
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') {
      return Promise.resolve((arg as (tx: unknown) => unknown)(prisma));
    }
    return Promise.resolve(arg);
  });

  const rolesService = {
    findByName: jest
      .fn()
      .mockResolvedValue({ id: 'role-seller', name: 'seller' }),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const storageService = {
    upload: jest.fn().mockResolvedValue({
      url: '/uploads/seller-verifications/fake.pdf',
      key: 'seller-verifications/fake.pdf',
    }),
    delete: jest.fn(),
  };

  const service = new SellersService(
    prisma as never,
    rolesService as never,
    auditService as never,
    eventEmitter,
    storageService,
  );

  return {
    prisma,
    rolesService,
    auditService,
    eventEmitter,
    storageService,
    service,
  };
}

describe('SellersService.findByUserId', () => {
  it('looks up a seller by userId, not by any seller id', async () => {
    const { prisma, service } = createDeps();
    const seller = { id: 'seller-1', userId: 'user-1' };
    prisma.seller.findUnique.mockResolvedValue(seller);

    const result = await service.findByUserId('user-1');

    expect(prisma.seller.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toBe(seller);
  });

  it('returns null for a user with no seller account, rather than throwing', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue(null);

    expect(await service.findByUserId('user-without-seller')).toBeNull();
  });
});

describe('SellersService.getPublicStorefront', () => {
  it('returns the storefront for an ACTIVE seller, with a real derived productCount/averageRating', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findFirst.mockResolvedValue({
      id: 'seller-1',
      slug: 'terracotta-and-fern',
      displayName: 'Terracotta & Fern',
      description: 'Small-batch planters.',
      logoUrl: null,
    });
    prisma.product.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _avg: { rating: { toNumber: () => 4.5 } },
    });

    const result = await service.getPublicStorefront('terracotta-and-fern');

    expect(prisma.seller.findFirst).toHaveBeenCalledWith({
      where: { slug: 'terracotta-and-fern', status: 'ACTIVE' },
    });
    expect(result.id).toBe('seller-1');
    expect(result.productCount).toBe(3);
    expect(result.averageRating).toBe(4.5);
  });

  it('404s for a seller that does not exist — never a distinguishing error', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findFirst.mockResolvedValue(null);

    await expect(service.getPublicStorefront('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404s for a real but non-ACTIVE seller (APPLIED/SUSPENDED/etc.) — the WHERE clause itself excludes them, never leaking their private status', async () => {
    const { prisma, service } = createDeps();
    // The mock never returns a non-ACTIVE row because the query's own
    // `status: 'ACTIVE'` filter would exclude it in real Postgres — this
    // test asserts the filter is actually present in the query.
    prisma.seller.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublicStorefront('a-suspended-seller'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.seller.findFirst).toHaveBeenCalledWith({
      where: { slug: 'a-suspended-seller', status: 'ACTIVE' },
    });
  });

  it('returns null averageRating (not 0) when no ACTIVE product has a rating yet — never fabricated', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findFirst.mockResolvedValue({
      slug: 'new-seller',
      displayName: 'New Seller',
      description: 'Just approved.',
      logoUrl: null,
    });
    prisma.product.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _avg: { rating: null },
    });

    const result = await service.getPublicStorefront('new-seller');

    expect(result.averageRating).toBeNull();
    expect(result.productCount).toBe(0);
  });
});

describe('SellersService.apply', () => {
  it('creates the Seller + SellerAddress and flips the user role to seller, in one transaction', async () => {
    const { prisma, service } = createDeps();
    const created = makeSellerRow({
      displayName: 'Terracotta & Fern',
      address: { addressLine1: '12 MG Road' },
    });
    prisma.seller.create.mockResolvedValue(created);

    const dto = {
      displayName: 'Terracotta & Fern',
      description: 'A'.repeat(25),
      contactEmail: 'hello@example.com',
      contactPhone: '+91 98765 43210',
      address: {
        addressLine1: '12 MG Road',
        city: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '411001',
      },
    };

    const result = await service.apply('user-1', dto);

    const [createArgs] = prisma.seller.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data).toMatchObject({
      userId: 'user-1',
      displayName: 'Terracotta & Fern',
      address: { create: dto.address },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { roleId: 'role-seller' },
    });
    expect(result.displayName).toBe('Terracotta & Fern');
  });

  it('rejects a duplicate application with a clean 409, not a raw database error', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['userId'] },
      }),
    );

    await expect(
      service.apply('user-1', {
        displayName: 'X',
        description: 'A'.repeat(25),
        contactEmail: 'a@b.com',
        contactPhone: '1234567',
        address: {
          addressLine1: 'x',
          city: 'x',
          state: 'x',
          country: 'x',
          postalCode: 'x',
        },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when the seller role has not been seeded', async () => {
    const { rolesService, service } = createDeps();
    rolesService.findByName.mockResolvedValue(null);

    await expect(
      service.apply('user-1', {
        displayName: 'X',
        description: 'A'.repeat(25),
        contactEmail: 'a@b.com',
        contactPhone: '1234567',
        address: {
          addressLine1: 'x',
          city: 'x',
          state: 'x',
          country: 'x',
          postalCode: 'x',
        },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SellersService.updateProfile', () => {
  it('blocks editing while SUSPENDED', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUniqueOrThrow.mockResolvedValue({ status: 'SUSPENDED' });

    await expect(
      service.updateProfile('seller-1', { displayName: 'New Name' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('re-enters the review queue (resets to APPLIED, clears the rejection note) when editing while REJECTED', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUniqueOrThrow.mockResolvedValue({ status: 'REJECTED' });
    prisma.seller.update.mockResolvedValue(
      makeSellerRow({ status: 'APPLIED', address: null }),
    );

    await service.updateProfile('seller-1', { displayName: 'Revised Name' });

    const [updateArgs] = prisma.seller.update.mock.calls[0];
    expect(updateArgs.data).toMatchObject({
      displayName: 'Revised Name',
      status: 'APPLIED',
      rejectedAt: null,
      rejectionNote: null,
    });
  });

  it('does not touch status when editing while ACTIVE', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUniqueOrThrow.mockResolvedValue({ status: 'ACTIVE' });
    prisma.seller.update.mockResolvedValue(makeSellerRow({ status: 'ACTIVE' }));

    await service.updateProfile('seller-1', { description: 'B'.repeat(25) });

    const [updateArgs] = prisma.seller.update.mock.calls[0];
    expect(updateArgs.data).not.toHaveProperty('status');
  });
});

describe('SellersService.uploadVerification', () => {
  it('validates, uploads via StorageService, and persists a SellerVerification row per file', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.sellerVerification.create.mockResolvedValue({
      id: 'ver-1',
      sellerId: 'seller-1',
      documentType: 'business-registration',
      documentUrl: '/uploads/seller-verifications/fake.pdf',
      status: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      createdAt: new Date(),
    });

    const result = await service.uploadVerification(
      'seller-1',
      'business-registration',
      [verificationFile()],
    );

    expect(storageService.upload).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'seller-verifications' }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].documentType).toBe('business-registration');
  });

  it('rejects an empty file list before touching storage', async () => {
    const { storageService, service } = createDeps();
    await expect(
      service.uploadVerification('seller-1', 'business-registration', []),
    ).rejects.toThrow(BadRequestException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it('rejects a file that fails signature validation before touching storage', async () => {
    const { storageService, service } = createDeps();
    const jpegAsPdf = verificationFile({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    });
    await expect(
      service.uploadVerification('seller-1', 'business-registration', [
        jpegAsPdf,
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });
});

describe('SellersService admin transitions', () => {
  it('adminApprove: APPLIED/UNDER_REVIEW -> ACTIVE directly (never a resting APPROVED), audited and emitted', async () => {
    const { prisma, auditService, eventEmitter, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 1 });
    prisma.seller.findUniqueOrThrow.mockResolvedValue(
      makeSellerRow({ status: 'ACTIVE' }),
    );

    await service.adminApprove('admin-1', 'seller-1', '127.0.0.1');

    const [approveArgs] = prisma.seller.updateMany.mock.calls[0];
    expect(approveArgs.where).toEqual({
      id: 'seller-1',
      status: { in: ['APPLIED', 'UNDER_REVIEW'] },
    });
    expect(approveArgs.data.status).toBe('ACTIVE');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SELLER_APPROVED',
        resourceId: 'seller-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.seller_approved',
      expect.objectContaining({ sellerId: 'seller-1' }),
    );
  });

  it('adminApprove: two concurrent decisions on the same seller — the loser gets a real 409, not a silent double-apply', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 0 }); // lost the race
    prisma.seller.findUnique.mockResolvedValue({ status: 'REJECTED' }); // the winner's outcome

    await expect(service.adminApprove('admin-1', 'seller-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('adminApprove: a nonexistent seller id gets a real 404, not a 409', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 0 });
    prisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.adminApprove('admin-1', 'nonexistent'),
    ).rejects.toThrow(NotFoundException);
  });

  it('adminReject: requires and records a reason, transitions to REJECTED', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 1 });
    prisma.seller.findUniqueOrThrow.mockResolvedValue(
      makeSellerRow({
        status: 'REJECTED',
        rejectionNote: 'Incomplete address',
      }),
    );

    await service.adminReject('admin-1', 'seller-1', {
      reason: 'Incomplete address',
    });

    const [rejectArgs] = prisma.seller.updateMany.mock.calls[0];
    expect(rejectArgs.where).toEqual({
      id: 'seller-1',
      status: { in: ['APPLIED', 'UNDER_REVIEW'] },
    });
    expect(rejectArgs.data).toMatchObject({
      status: 'REJECTED',
      rejectionNote: 'Incomplete address',
    });
  });

  it('adminSuspend: only from ACTIVE', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 1 });
    prisma.seller.findUniqueOrThrow.mockResolvedValue(
      makeSellerRow({ status: 'SUSPENDED' }),
    );

    await service.adminSuspend('admin-1', 'seller-1', {});

    const [suspendArgs] = prisma.seller.updateMany.mock.calls[0];
    expect(suspendArgs.where).toEqual({
      id: 'seller-1',
      status: { in: ['ACTIVE'] },
    });
    expect(suspendArgs.data.status).toBe('SUSPENDED');
  });

  it('adminReactivate: from either SUSPENDED or DEACTIVATED, back to ACTIVE', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 1 });
    prisma.seller.findUniqueOrThrow.mockResolvedValue(
      makeSellerRow({ status: 'ACTIVE' }),
    );

    await service.adminReactivate('admin-1', 'seller-1');

    const [reactivateArgs] = prisma.seller.updateMany.mock.calls[0];
    expect(reactivateArgs.where).toEqual({
      id: 'seller-1',
      status: { in: ['SUSPENDED', 'DEACTIVATED'] },
    });
    expect(reactivateArgs.data.status).toBe('ACTIVE');
  });

  it('adminDeactivate: from ACTIVE or SUSPENDED', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.updateMany.mockResolvedValue({ count: 1 });
    prisma.seller.findUniqueOrThrow.mockResolvedValue(
      makeSellerRow({ status: 'DEACTIVATED' }),
    );

    await service.adminDeactivate('admin-1', 'seller-1', {
      note: 'Policy violation',
    });

    const [deactivateArgs] = prisma.seller.updateMany.mock.calls[0];
    expect(deactivateArgs.where).toEqual({
      id: 'seller-1',
      status: { in: ['ACTIVE', 'SUSPENDED'] },
    });
    expect(deactivateArgs.data).toMatchObject({
      status: 'DEACTIVATED',
      statusNote: 'Policy violation',
    });
  });
});

describe('SellersService.adminGetDetail', () => {
  it('throws NotFoundException for an id that does not exist', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue(null);

    await expect(service.adminGetDetail('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

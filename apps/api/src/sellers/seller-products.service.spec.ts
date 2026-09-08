import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SellerProductsService } from './seller-products.service';
import type { ProductMediaFileLike } from './seller-product-media-file.util';
import type { Seller } from '@prisma/client';

function jpegBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100),
  ]);
}

function mediaFile(
  overrides: Partial<ProductMediaFileLike> = {},
): ProductMediaFileLike {
  const buffer = overrides.buffer ?? jpegBuffer();
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: 'seller-1',
    userId: 'user-1',
    status: 'ACTIVE',
    ...overrides,
  } as Seller;
}

function makeProductRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    slug: 'test-plant-abcd',
    name: 'Test Plant',
    price: { toNumber: () => 499 },
    compareAtPrice: null,
    description: 'A'.repeat(25),
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Plants' },
    careLevel: null,
    approvalStatus: 'DRAFT',
    rejectionNote: null,
    sellerId: 'seller-1',
    stockCount: 5,
    inStock: true,
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn<
        Promise<unknown>,
        [{ where: Record<string, unknown> }]
      >(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [{ where: Record<string, unknown>; data: Record<string, unknown> }]
      >(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: { findUnique: jest.fn() },
    productImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    inventoryItem: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return Promise.resolve(arg);
  });

  const inventoryService = {
    createItem: jest.fn(),
    adjustStock: jest.fn(),
  };
  const warehousesService = {
    getDefaultOrThrow: jest
      .fn()
      .mockResolvedValue({ id: 'wh-1', code: 'MAIN' }),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const storageService = {
    upload: jest.fn().mockResolvedValue({
      url: '/uploads/product-media/fake.jpg',
      key: 'product-media/fake.jpg',
    }),
    delete: jest.fn(),
    createReadStream: jest.fn(),
  };

  const service = new SellerProductsService(
    prisma as never,
    inventoryService as never,
    warehousesService as never,
    auditService as never,
    eventEmitter,
    storageService,
  );

  return {
    prisma,
    inventoryService,
    warehousesService,
    auditService,
    eventEmitter,
    storageService,
    service,
  };
}

describe('SellerProductsService.createDraft', () => {
  const dto = {
    name: 'New Plant',
    price: 100,
    description: 'A'.repeat(25),
    categoryId: 'cat-1',
    initialStock: 10,
  };

  it('rejects an invalid category before creating anything', async () => {
    const { prisma, service } = createDeps();
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(service.createDraft(makeSeller(), dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('creates the Product as DRAFT/SELLER_OWNED, then its InventoryItem', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    const created = makeProductRow();
    prisma.product.create.mockResolvedValue(created);
    prisma.product.findUniqueOrThrow.mockResolvedValue(created);

    const result = await service.createDraft(makeSeller(), dto);

    const [createArgs] = prisma.product.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data).toMatchObject({
      sellerId: 'seller-1',
      ownerType: 'SELLER_OWNED',
      approvalStatus: 'DRAFT',
    });
    expect(inventoryService.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ productId: created.id, quantityOnHand: 10 }),
    );
    expect(result.name).toBe('Test Plant');
  });

  it('best-effort deletes the just-created product if inventory setup fails, so the operation feels atomic', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    const created = makeProductRow();
    prisma.product.create.mockResolvedValue(created);
    prisma.product.delete.mockResolvedValue(created);
    inventoryService.createItem.mockRejectedValue(new Error('warehouse full'));

    await expect(service.createDraft(makeSeller(), dto)).rejects.toThrow(
      'warehouse full',
    );
    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { id: created.id },
    });
  });
});

describe('SellerProductsService.updateDraft', () => {
  it('is scoped by sellerId in the WHERE clause — never trusts a client-supplied owner', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(makeProductRow());

    await service.updateDraft(makeSeller({ id: 'seller-1' }), 'prod-1', {
      name: 'Updated',
    });

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({
      id: 'prod-1',
      sellerId: 'seller-1',
      approvalStatus: { in: ['DRAFT', 'REJECTED'] },
    });
  });

  it('resets REJECTED to DRAFT and clears the rejection note, unconditionally in the same atomic update', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'DRAFT', rejectionNote: null }),
    );

    await service.updateDraft(makeSeller(), 'prod-1', { name: 'Fixed' });

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.data).toMatchObject({
      approvalStatus: 'DRAFT',
      rejectionNote: null,
    });
  });

  it('throws ConflictException (not silently succeeding) when the product is not in an editable state', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    prisma.product.findFirst.mockResolvedValue({ approvalStatus: 'ACTIVE' });

    await expect(
      service.updateDraft(makeSeller(), 'prod-1', { name: 'X' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException for a product that does not belong to this seller', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.updateDraft(makeSeller(), 'someone-elses-product', { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('computes the stock delta and applies it via InventoryService.adjustStock, never writing stockCount directly', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(makeProductRow());
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'item-1',
      quantityOnHand: 5,
    });

    await service.updateDraft(makeSeller(), 'prod-1', { stock: 20 });

    expect(inventoryService.adjustStock).toHaveBeenCalledWith('item-1', 15);
  });

  it('does not call adjustStock when stock is unchanged (delta 0)', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(makeProductRow());
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'item-1',
      quantityOnHand: 5,
    });

    await service.updateDraft(makeSeller(), 'prod-1', { stock: 5 });

    expect(inventoryService.adjustStock).not.toHaveBeenCalled();
  });
});

describe('SellerProductsService.submitForModeration', () => {
  it('refuses when the seller account itself is not ACTIVE — the earliest gate for "no seller may sell"', async () => {
    const { prisma, service } = createDeps();
    await expect(
      service.submitForModeration(makeSeller({ status: 'APPLIED' }), 'prod-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('DRAFT -> SUBMITTED, audited and emitted, for an ACTIVE seller', async () => {
    const { prisma, auditService, eventEmitter, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'SUBMITTED' }),
    );

    await service.submitForModeration(
      makeSeller({ status: 'ACTIVE' }),
      'prod-1',
    );

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({ approvalStatus: 'DRAFT' });
    expect(args.data.approvalStatus).toBe('SUBMITTED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_SUBMITTED' }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.product_submitted',
      expect.objectContaining({ productId: 'prod-1' }),
    );
  });
});

describe('SellerProductsService.archive', () => {
  it('ACTIVE -> ARCHIVED only', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'ARCHIVED' }),
    );

    await service.archive(makeSeller(), 'prod-1');

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({ approvalStatus: 'ACTIVE' });
    expect(args.data.approvalStatus).toBe('ARCHIVED');
  });

  it('refuses when the seller account itself is not ACTIVE — P0-C-5, same gate as submitForModeration', async () => {
    const { prisma, service } = createDeps();
    await expect(
      service.archive(makeSeller({ status: 'SUSPENDED' }), 'prod-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });
});

describe('SellerProductsService.uploadMedia', () => {
  it('404s for a product that does not belong to this seller — before touching storage', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadMedia(makeSeller(), 'someone-elses-product', [mediaFile()]),
    ).rejects.toThrow(NotFoundException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it('refuses to add media to an ARCHIVED product', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(
      makeProductRow({ approvalStatus: 'ARCHIVED' }),
    );

    await expect(
      service.uploadMedia(makeSeller(), 'prod-1', [mediaFile()]),
    ).rejects.toThrow(BadRequestException);
  });

  it('validates every file before uploading any of them', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(makeProductRow());
    const badFile = mediaFile({
      mimetype: 'application/pdf',
      originalname: 'x.pdf',
    });

    await expect(
      service.uploadMedia(makeSeller(), 'prod-1', [mediaFile(), badFile]),
    ).rejects.toThrow(BadRequestException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it('persists the StorageService-returned key, not just the public url — so deleteMedia can later actually delete the file', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(makeProductRow());
    prisma.product.findUniqueOrThrow.mockResolvedValue(makeProductRow());

    await service.uploadMedia(makeSeller(), 'prod-1', [mediaFile()]);

    const [createArgs] = prisma.productImage.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data).toMatchObject({ key: 'product-media/fake.jpg' });
  });
});

describe('SellerProductsService.deleteMedia', () => {
  it('deletes the DB row AND the underlying stored file via its persisted key', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.product.findFirst
      .mockResolvedValueOnce(makeProductRow()) // findOwnedOrThrow
      .mockResolvedValueOnce(makeProductRow()); // post-delete refetch via findUniqueOrThrow below
    prisma.productImage.findFirst.mockResolvedValue({
      id: 'img-1',
      productId: 'prod-1',
      key: 'product-media/abc.jpg',
    });
    prisma.product.findUniqueOrThrow.mockResolvedValue(makeProductRow());
    storageService.delete.mockResolvedValue(undefined);

    await service.deleteMedia(makeSeller(), 'prod-1', 'img-1');

    expect(prisma.productImage.delete).toHaveBeenCalledWith({
      where: { id: 'img-1' },
    });
    expect(storageService.delete).toHaveBeenCalledWith('product-media/abc.jpg');
  });

  it('404s for an image that does not belong to this product', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(makeProductRow());
    prisma.productImage.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteMedia(makeSeller(), 'prod-1', 'not-this-products-image'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SellerProductsService admin transitions', () => {
  it('adminApprove: SUBMITTED/UNDER_REVIEW -> ACTIVE directly, scoped to SELLER_OWNED products only', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'ACTIVE' }),
    );

    await service.adminApprove('admin-1', 'prod-1');

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({
      ownerType: 'SELLER_OWNED',
      approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    });
    expect(args.data.approvalStatus).toBe('ACTIVE');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_APPROVED' }),
    );
  });

  it('adminReject and adminRequestChanges share the same transition but record distinct audit actions', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'REJECTED' }),
    );

    await service.adminReject('admin-1', 'prod-1', { reason: 'Bad photos' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_REJECTED' }),
    );

    await service.adminRequestChanges('admin-1', 'prod-1', {
      reason: 'Add more detail',
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_CHANGES_REQUESTED' }),
    );
  });

  it('adminDeactivate: ACTIVE -> ARCHIVED', async () => {
    const { prisma, service } = createDeps();
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      makeProductRow({ approvalStatus: 'ARCHIVED' }),
    );

    await service.adminDeactivate('admin-1', 'prod-1');

    const [args] = prisma.product.updateMany.mock.calls[0];
    expect(args.where).toMatchObject({ approvalStatus: { in: ['ACTIVE'] } });
    expect(args.data.approvalStatus).toBe('ARCHIVED');
  });

  it('adminGetDetail: 404s for a product that exists but is Folia-owned, not seller-owned — the two admin surfaces stay separate', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.adminGetDetail('folia-product-1')).rejects.toThrow(
      NotFoundException,
    );
    const [args] = prisma.product.findFirst.mock.calls[0];
    expect(args.where).toMatchObject({ ownerType: 'SELLER_OWNED' });
  });
});

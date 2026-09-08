import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { Seller, ProductApprovalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import {
  MAX_PRODUCT_MEDIA_FILES,
  validateProductMediaFile,
  type ProductMediaFileLike,
} from './seller-product-media-file.util';
import {
  toAdminSellerProductRecord,
  toSellerProductRecord,
  type AdminSellerProductRecord,
  type SellerProductRecord,
} from './seller-product.types';
import type { SellerProductInputDto } from './dto/seller-product-input.dto';
import type { UpdateSellerProductDto } from './dto/update-seller-product.dto';
import type { RejectSellerProductDto } from './dto/reject-seller-product.dto';
import type { AdminSellerProductsQueryDto } from './dto/admin-seller-products-query.dto';
import {
  NOTIFICATION_EVENTS,
  type ProductSubmittedPayload,
  type ProductApprovedPayload,
  type ProductRejectedPayload,
  type ProductDeactivatedPayload,
} from '../notifications/notification.events';

const PRODUCT_INCLUDE = {
  category: true,
  images: true,
} satisfies Prisma.ProductDefaultArgs['include'];

const ADMIN_PRODUCT_INCLUDE = {
  category: true,
  images: true,
  seller: { select: { id: true, displayName: true } },
} satisfies Prisma.ProductDefaultArgs['include'];

const ADMIN_STATUS_FILTER_MAP: Record<
  AdminSellerProductsQueryDto['status'],
  ProductApprovalStatus[] | undefined
> = {
  all: undefined,
  submitted: ['SUBMITTED'],
  'under-review': ['UNDER_REVIEW'],
  rejected: ['REJECTED'],
  active: ['ACTIVE'],
  archived: ['ARCHIVED'],
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product'
  );
}

/**
 * Marketplace Phase 3 — seller product listing. Deliberately its own
 * service (not folded into ProductsService, which owns the customer/
 * admin-catalog read/write paths that assume Folia ownership throughout)
 * — every method here is sellerId-scoped, reusing InventoryService/
 * StorageService/AuditService rather than introducing parallel
 * mechanisms, matching this codebase's Marketplace Phase 1/2 precedent.
 */
@Injectable()
export class SellerProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly warehousesService: WarehousesService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  // --- Seller-facing ---

  async listMy(seller: Seller): Promise<SellerProductRecord[]> {
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return products.map(toSellerProductRecord);
  }

  async getMy(seller: Seller, productId: string): Promise<SellerProductRecord> {
    const product = await this.findOwnedOrThrow(seller.id, productId);
    return toSellerProductRecord(product);
  }

  /**
   * Creates the Product row and its first InventoryItem together. These
   * are two separate real writes (InventoryService.createItem manages
   * its own transaction — this codebase's inventory concurrency
   * primitives are deliberately self-contained, not designed to compose
   * into an outer cross-service transaction), so if the inventory step
   * fails after the product succeeds, the just-created product (which
   * nothing else could possibly reference yet — it's brand new and still
   * DRAFT) is best-effort hard-deleted so the operation still FEELS
   * atomic to the caller: either a real, stocked product exists, or
   * nothing does. Mirrors this codebase's existing "best-effort cleanup
   * on a downstream failure" philosophy (see returns.service.ts's
   * evidence-upload cleanup).
   */
  async createDraft(
    seller: Seller,
    dto: SellerProductInputDto,
  ): Promise<SellerProductRecord> {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException('Invalid category.');
    }

    const slug = `${slugify(dto.name)}-${randomBytes(3).toString('hex')}`;
    const product = await this.prisma.product.create({
      data: {
        slug,
        name: dto.name,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        description: dto.description,
        categoryId: dto.categoryId,
        careLevel: careLevelToDb(dto.careLevel),
        sellerId: seller.id,
        ownerType: 'SELLER_OWNED',
        approvalStatus: 'DRAFT',
      },
      include: PRODUCT_INCLUDE,
    });

    try {
      const warehouse = await this.warehousesService.getDefaultOrThrow();
      await this.inventoryService.createItem({
        productId: product.id,
        warehouseId: warehouse.id,
        sku: `${slug}-${warehouse.code}`.toUpperCase(),
        quantityOnHand: dto.initialStock,
      });
    } catch (err) {
      await this.prisma.product
        .delete({ where: { id: product.id } })
        .catch(() => undefined);
      throw err;
    }

    const created = await this.prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: PRODUCT_INCLUDE,
    });
    return toSellerProductRecord(created);
  }

  /**
   * Only usable while DRAFT or REJECTED — enforced by the WHERE clause
   * itself, atomically, so this never needs a separate read-then-decide
   * step. Editing while REJECTED resets approvalStatus to DRAFT and
   * clears rejectionNote in the SAME conditional update (setting DRAFT
   * unconditionally is a safe no-op when the row was already DRAFT) —
   * matching the lifecycle diagram's literal "REJECTED -> DRAFT" arrow
   * and Marketplace Phase 2's identical UpdateSellerDto pattern.
   */
  async updateDraft(
    seller: Seller,
    productId: string,
    dto: UpdateSellerProductDto,
  ): Promise<SellerProductRecord> {
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new BadRequestException('Invalid category.');
    }

    const { count } = await this.prisma.product.updateMany({
      where: {
        id: productId,
        sellerId: seller.id,
        approvalStatus: { in: ['DRAFT', 'REJECTED'] },
      },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.compareAtPrice !== undefined && {
          compareAtPrice: dto.compareAtPrice,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.careLevel !== undefined && {
          careLevel: careLevelToDb(dto.careLevel),
        }),
        approvalStatus: 'DRAFT',
        rejectionNote: null,
      },
    });
    if (count === 0) await this.rejectStaleWrite(seller.id, productId);

    if (dto.stock !== undefined) {
      await this.setAbsoluteStock(productId, dto.stock);
    }

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    return toSellerProductRecord(updated);
  }

  /** Requires the seller's OWN account to be ACTIVE — the earliest gate
   * at which "no seller may sell while APPLIED/UNDER_REVIEW/REJECTED/
   * SUSPENDED/DEACTIVATED" actually bites for products: a seller can
   * still draft/edit while pending approval, but cannot enter the
   * moderation queue until their own account is ACTIVE. */
  async submitForModeration(
    seller: Seller,
    productId: string,
  ): Promise<SellerProductRecord> {
    if (seller.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your seller account must be active before you can submit products for review.',
      );
    }

    const { count } = await this.prisma.product.updateMany({
      where: { id: productId, sellerId: seller.id, approvalStatus: 'DRAFT' },
      data: { approvalStatus: 'SUBMITTED' },
    });
    if (count === 0) await this.rejectStaleWrite(seller.id, productId);

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.log({
      actorId: seller.userId,
      action: 'PRODUCT_SUBMITTED',
      resource: 'product',
      resourceId: productId,
    });
    const payload: ProductSubmittedPayload = {
      productId,
      sellerId: seller.id,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PRODUCT_SUBMITTED, payload);

    return toSellerProductRecord(updated);
  }

  /** ACTIVE -> ARCHIVED, seller-initiated (distinct audit action from
   * adminDeactivate's admin-initiated equivalent, same terminal status).
   * P0-C-5 — same ACTIVE-only gate as submitForModeration: SellerGuard
   * itself is deliberately status-agnostic (see apply()'s doc comment),
   * so this is the enforcement point that keeps a SUSPENDED/DEACTIVATED
   * seller from continuing to mutate their catalog after an admin has
   * revoked their standing. */
  async archive(
    seller: Seller,
    productId: string,
  ): Promise<SellerProductRecord> {
    if (seller.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your seller account must be active to archive products.',
      );
    }

    const { count } = await this.prisma.product.updateMany({
      where: { id: productId, sellerId: seller.id, approvalStatus: 'ACTIVE' },
      data: { approvalStatus: 'ARCHIVED' },
    });
    if (count === 0) await this.rejectStaleWrite(seller.id, productId);

    await this.auditService.log({
      actorId: seller.userId,
      action: 'PRODUCT_ARCHIVED',
      resource: 'product',
      resourceId: productId,
    });

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    return toSellerProductRecord(updated);
  }

  /** Blocked only once ARCHIVED — a seller may add/update photos at any
   * other point in the lifecycle, including on a live ACTIVE listing,
   * without that alone re-triggering moderation (a photo swap is lower-
   * risk than a full catalog edit, which IS gated to DRAFT/REJECTED). */
  async uploadMedia(
    seller: Seller,
    productId: string,
    files: ProductMediaFileLike[],
  ): Promise<SellerProductRecord> {
    const product = await this.findOwnedOrThrow(seller.id, productId);
    if (product.approvalStatus === 'ARCHIVED') {
      throw new BadRequestException(
        'This product is archived and cannot be edited.',
      );
    }
    if (files.length === 0) {
      throw new BadRequestException('At least one file is required.');
    }
    if (files.length > MAX_PRODUCT_MEDIA_FILES) {
      throw new BadRequestException(
        `At most ${MAX_PRODUCT_MEDIA_FILES} files may be uploaded at once.`,
      );
    }
    files.forEach(validateProductMediaFile);

    const existingCount = product.images.length;
    const uploaded = await Promise.all(
      files.map((file) =>
        this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalname,
          mimetype: file.mimetype,
          directory: 'product-media',
        }),
      ),
    );
    await this.prisma.$transaction(
      uploaded.map((result, i) =>
        this.prisma.productImage.create({
          data: {
            productId,
            url: result.url,
            key: result.key,
            position: existingCount + i,
          },
        }),
      ),
    );

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    return toSellerProductRecord(updated);
  }

  /**
   * Deletes the row AND the underlying stored file — the first "delete an
   * already-persisted upload" feature this codebase has (ReturnEvidence,
   * this schema's closest sibling, has no delete endpoint at all, and no
   * stored key to delete by — see ProductImage.key's own comment). The
   * storage delete happens AFTER the DB delete commits: if it fails, an
   * orphaned file on disk is a harmless leak; deleting the file first and
   * having the DB write fail would leave a dangling ProductImage row
   * pointing at nothing, which is worse.
   */
  async deleteMedia(
    seller: Seller,
    productId: string,
    imageId: string,
  ): Promise<SellerProductRecord> {
    await this.findOwnedOrThrow(seller.id, productId);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found.');

    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.key) {
      await this.storageService.delete(image.key).catch(() => undefined);
    }

    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    return toSellerProductRecord(updated);
  }

  // --- Admin ---

  async adminList(query: AdminSellerProductsQueryDto) {
    const statusFilter = ADMIN_STATUS_FILTER_MAP[query.status];
    const where: Prisma.ProductWhereInput = {
      ownerType: 'SELLER_OWNED',
      ...(statusFilter && { approvalStatus: { in: statusFilter } }),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: ADMIN_PRODUCT_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: products.map(toAdminSellerProductRecord),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async adminGetDetail(id: string): Promise<AdminSellerProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { id, ownerType: 'SELLER_OWNED' },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Seller product not found.');
    return toAdminSellerProductRecord(product);
  }

  /** SUBMITTED/UNDER_REVIEW -> ACTIVE directly — same reasoning as
   * SellersService.adminApprove: "Only approved/active products may
   * appear in the customer marketplace" makes a resting APPROVED state
   * functionally equivalent to ACTIVE here too, with no described
   * trigger for a separate second step. */
  async adminApprove(
    adminId: string,
    id: string,
    ipAddress?: string,
  ): Promise<AdminSellerProductRecord> {
    await this.transitionStatus(id, ['SUBMITTED', 'UNDER_REVIEW'], {
      approvalStatus: 'ACTIVE',
    });
    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: ADMIN_PRODUCT_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'PRODUCT_APPROVED',
      resource: 'product',
      resourceId: id,
      ipAddress,
    });
    const payload: ProductApprovedPayload = {
      productId: id,
      sellerId: updated.sellerId ?? '',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PRODUCT_APPROVED, payload);

    return toAdminSellerProductRecord(updated);
  }

  /** SUBMITTED/UNDER_REVIEW -> REJECTED. Shares its mechanism with
   * adminRequestChanges (see RejectSellerProductDto's own comment for
   * why) — only the audit action name differs, so the trail preserves
   * which one an admin actually chose. */
  async adminReject(
    adminId: string,
    id: string,
    dto: RejectSellerProductDto,
    ipAddress?: string,
  ): Promise<AdminSellerProductRecord> {
    return this.rejectOrRequestChanges(
      adminId,
      id,
      dto,
      'PRODUCT_REJECTED',
      ipAddress,
    );
  }

  async adminRequestChanges(
    adminId: string,
    id: string,
    dto: RejectSellerProductDto,
    ipAddress?: string,
  ): Promise<AdminSellerProductRecord> {
    return this.rejectOrRequestChanges(
      adminId,
      id,
      dto,
      'PRODUCT_CHANGES_REQUESTED',
      ipAddress,
    );
  }

  private async rejectOrRequestChanges(
    adminId: string,
    id: string,
    dto: RejectSellerProductDto,
    auditAction: 'PRODUCT_REJECTED' | 'PRODUCT_CHANGES_REQUESTED',
    ipAddress?: string,
  ): Promise<AdminSellerProductRecord> {
    await this.transitionStatus(id, ['SUBMITTED', 'UNDER_REVIEW'], {
      approvalStatus: 'REJECTED',
      rejectionNote: dto.reason,
    });
    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: ADMIN_PRODUCT_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: auditAction,
      resource: 'product',
      resourceId: id,
      metadata: { reason: dto.reason },
      ipAddress,
    });
    const payload: ProductRejectedPayload = {
      productId: id,
      sellerId: updated.sellerId ?? '',
      reason: dto.reason,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PRODUCT_REJECTED, payload);

    return toAdminSellerProductRecord(updated);
  }

  /** ACTIVE -> ARCHIVED, admin-initiated (policy enforcement) — same
   * terminal status as a seller's own archive action, distinct audit
   * trail entry. */
  async adminDeactivate(
    adminId: string,
    id: string,
    ipAddress?: string,
  ): Promise<AdminSellerProductRecord> {
    await this.transitionStatus(id, ['ACTIVE'], { approvalStatus: 'ARCHIVED' });
    const updated = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: ADMIN_PRODUCT_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'PRODUCT_DEACTIVATED',
      resource: 'product',
      resourceId: id,
      ipAddress,
    });
    const payload: ProductDeactivatedPayload = {
      productId: id,
      sellerId: updated.sellerId ?? '',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PRODUCT_DEACTIVATED, payload);

    return toAdminSellerProductRecord(updated);
  }

  // --- Shared internals ---

  /** Never trusts a client-supplied sellerId — ownership is always this
   * query's own WHERE clause. A product that exists but belongs to
   * another seller (or is Folia-owned, sellerId: null) 404s exactly like
   * a nonexistent one, matching this codebase's ownership-check
   * convention throughout. */
  private async findOwnedOrThrow(sellerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private async rejectStaleWrite(
    sellerId: string,
    productId: string,
  ): Promise<never> {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Product not found.');
    throw new ConflictException(
      `Product is currently ${existing.approvalStatus} and cannot make this change.`,
    );
  }

  /** Same atomic-conditional-update idiom as SellersService.transitionStatus. */
  private async transitionStatus(
    id: string,
    allowedFrom: ProductApprovalStatus[],
    data: Prisma.ProductUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await this.prisma.product.updateMany({
      where: {
        id,
        ownerType: 'SELLER_OWNED',
        approvalStatus: { in: allowedFrom },
      },
      data,
    });
    if (count > 0) return;

    const existing = await this.prisma.product.findFirst({
      where: { id, ownerType: 'SELLER_OWNED' },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Seller product not found.');
    throw new ConflictException(
      `Product is currently ${existing.approvalStatus} and cannot make this transition.`,
    );
  }

  /** Computes the delta from the product's current available stock to the
   * requested absolute value and applies it via InventoryService.
   * adjustStock — never writes Product.stockCount directly. Assumes one
   * InventoryItem per seller product (Marketplace Phase 3 doesn't build
   * seller product variants — see docs). */
  private async setAbsoluteStock(productId: string, newStock: number) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { productId, variantId: null },
    });
    if (!item) {
      throw new NotFoundException(
        'No inventory record exists for this product.',
      );
    }
    const delta = newStock - item.quantityOnHand;
    if (delta !== 0) {
      await this.inventoryService.adjustStock(item.id, delta);
    }
  }
}

function careLevelToDb(
  careLevel: 'Easy' | 'Moderate' | 'Advanced' | undefined,
): 'EASY' | 'MODERATE' | 'ADVANCED' | null {
  if (!careLevel) return null;
  return { Easy: 'EASY', Moderate: 'MODERATE', Advanced: 'ADVANCED' }[
    careLevel
  ] as 'EASY' | 'MODERATE' | 'ADVANCED';
}

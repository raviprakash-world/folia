import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { Seller, SellerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import {
  MAX_VERIFICATION_FILES,
  validateVerificationFile,
  type VerificationFileLike,
} from './seller-verification-file.util';
import {
  toAdminSellerRecord,
  toPublicSellerStorefront,
  toSellerProfile,
  toSellerVerification,
  type AdminSellerRecord,
  type PublicSellerStorefront,
  type SellerProfile,
  type SellerVerificationRecord,
} from './seller.types';
import type { ApplySellerDto } from './dto/apply-seller.dto';
import type { UpdateSellerDto } from './dto/update-seller.dto';
import type { RejectSellerDto } from './dto/reject-seller.dto';
import type { SellerStatusNoteDto } from './dto/seller-status-note.dto';
import type { AdminSellersQueryDto } from './dto/admin-sellers-query.dto';
import {
  NOTIFICATION_EVENTS,
  type SellerAppliedPayload,
  type SellerApprovedPayload,
  type SellerRejectedPayload,
  type SellerSuspendedPayload,
  type SellerReactivatedPayload,
  type SellerDeactivatedPayload,
} from '../notifications/notification.events';

/** Marketplace Phase 1's role name — the one this codebase's seed.ts
 * upserts. Mirrors RolesService's own DEFAULT_ROLE_NAME convention. */
export const SELLER_ROLE_NAME = 'seller';

const SELLER_WITH_ADDRESS = {
  include: { address: true },
} satisfies Prisma.SellerDefaultArgs;

const SELLER_ADMIN_INCLUDE = {
  include: { address: true, verifications: true },
} satisfies Prisma.SellerDefaultArgs;

type SellerWithAddress = Prisma.SellerGetPayload<typeof SELLER_WITH_ADDRESS>;

const ADMIN_STATUS_FILTER_MAP: Record<
  AdminSellersQueryDto['status'],
  SellerStatus[] | undefined
> = {
  all: undefined,
  applied: ['APPLIED'],
  'under-review': ['UNDER_REVIEW'],
  rejected: ['REJECTED'],
  active: ['ACTIVE'],
  suspended: ['SUSPENDED'],
  deactivated: ['DEACTIVATED'],
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'seller'
  );
}

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  /**
   * Never accepts a sellerId from a caller — always looked up by the
   * authenticated user's own id. This is the one method SellerGuard calls
   * to derive seller identity server-side; every other seller-scoped
   * method in this service resolves identity the same way, never by
   * trusting an id supplied in a request.
   */
  async findByUserId(userId: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { userId } });
  }

  async getMyProfile(sellerId: string): Promise<SellerProfile> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      ...SELLER_WITH_ADDRESS,
    });
    return toSellerProfile(seller);
  }

  /**
   * Marketplace Phase 4 — public, unauthenticated storefront read. Only
   * ACTIVE sellers are ever returned; an APPLIED/UNDER_REVIEW/REJECTED/
   * SUSPENDED/DEACTIVATED seller's slug 404s exactly like a nonexistent
   * one (the brief's own words: "Only ACTIVE seller + ACTIVE product
   * combinations are publicly visible" — never a distinguishing error
   * that would leak a seller's private status to a customer). productCount/
   * averageRating are both computed live from this seller's real ACTIVE
   * products, not cached fields — the same derive-don't-cache convention
   * this codebase already uses throughout (StoreCreditEntry's balance,
   * SellerLedgerEntry's balance).
   */
  async getPublicStorefront(slug: string): Promise<PublicSellerStorefront> {
    const seller = await this.prisma.seller.findFirst({
      where: { slug, status: 'ACTIVE' },
    });
    if (!seller) throw new NotFoundException('Seller not found.');

    const aggregate = await this.prisma.product.aggregate({
      where: { sellerId: seller.id, approvalStatus: 'ACTIVE', deletedAt: null },
      _count: { _all: true },
      _avg: { rating: true },
    });

    return toPublicSellerStorefront(
      seller,
      aggregate._count._all,
      aggregate._avg.rating?.toNumber() ?? null,
    );
  }

  /**
   * Creates the Seller + SellerAddress rows and flips the applicant's
   * User.role to 'seller' in one transaction — role flips at APPLICATION
   * time, not approval, deliberately: SellerGuard's own access check
   * (Phase 1) is entirely status-agnostic (it resolves whatever Seller row
   * exists, regardless of status), so an early role change grants no
   * inappropriate access; what it DOES do is let the applicant reach a
   * role="seller"-gated frontend route at all, immediately, to see their
   * own application status — exactly the "view application status"
   * requirement this phase's brief lists. Actual selling permission is
   * gated on Seller.status === 'ACTIVE' in a later marketplace phase's
   * product-write services, never on role.
   */
  async apply(userId: string, dto: ApplySellerDto): Promise<SellerProfile> {
    const sellerRole = await this.rolesService.findByName(SELLER_ROLE_NAME);
    if (!sellerRole) {
      throw new NotFoundException(
        `The "${SELLER_ROLE_NAME}" role is not seeded — run \`npm run prisma:seed\`.`,
      );
    }
    // A random suffix, not a uniqueness pre-check-then-insert — the real
    // guarantee against a slug collision is the column's own @unique
    // constraint (caught below), same reasoning this codebase already
    // uses for ReturnRequest.orderId/CancellationRequest's own creation
    // races (see returns.service.ts's own comment on this exact idiom).
    const slug = `${slugify(dto.displayName)}-${randomBytes(3).toString('hex')}`;

    let seller: SellerWithAddress;
    try {
      seller = await this.prisma.$transaction(async (tx) => {
        const created = await tx.seller.create({
          data: {
            userId,
            slug,
            displayName: dto.displayName,
            description: dto.description,
            logoUrl: dto.logoUrl,
            contactEmail: dto.contactEmail,
            contactPhone: dto.contactPhone,
            address: { create: { ...dto.address } },
          },
          include: { address: true },
        });
        await tx.user.update({
          where: { id: userId },
          data: { roleId: sellerRole.id },
        });
        return created;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = Array.isArray(err.meta?.target)
          ? (err.meta.target as string[])
          : [];
        if (target.includes('userId')) {
          throw new ConflictException('You already have a seller application.');
        }
        // A slug collision — astronomically unlikely given the random
        // suffix, but handled honestly rather than surfaced as a raw 500.
        throw new ConflictException(
          'Could not create a unique seller identifier — please try again.',
        );
      }
      throw err;
    }

    await this.auditService.log({
      actorId: userId,
      action: 'SELLER_APPLIED',
      resource: 'seller',
      resourceId: seller.id,
    });

    const payload: SellerAppliedPayload = { sellerId: seller.id, userId };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_APPLIED, payload);

    return toSellerProfile(seller);
  }

  /**
   * A partial profile edit, not a re-submission. Blocked while SUSPENDED/
   * DEACTIVATED (an admin-imposed block on selling should also block
   * touching the storefront profile that customers would see). Editing
   * while REJECTED re-enters the review queue (status resets to APPLIED,
   * the rejection note is cleared) — mirrors the Product lifecycle's own
   * explicit REJECTED -> DRAFT loop-back exactly.
   *
   * Deliberately a plain read-then-write, not an atomic conditional
   * update: the brief's concurrency-safety requirement is explicitly
   * scoped to "every state-changing ADMIN action" (see adminApprove/
   * adminReject/adminSuspend/adminReactivate/adminDeactivate below, which
   * all use the atomic idiom) — this is a low-stakes self-service edit,
   * not a financial or security-critical transition, so a narrow
   * TOCTOU window against a concurrent admin action is an acceptable,
   * proportionate risk rather than one worth the extra complexity here.
   */
  async updateProfile(
    sellerId: string,
    dto: UpdateSellerDto,
  ): Promise<SellerProfile> {
    const existing = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { status: true },
    });
    if (existing.status === 'SUSPENDED' || existing.status === 'DEACTIVATED') {
      throw new BadRequestException(
        `Your seller account is currently ${existing.status.toLowerCase()} and cannot be edited.`,
      );
    }
    const resubmitting = existing.status === 'REJECTED';

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.contactEmail !== undefined && {
          contactEmail: dto.contactEmail,
        }),
        ...(dto.contactPhone !== undefined && {
          contactPhone: dto.contactPhone,
        }),
        ...(resubmitting && {
          status: 'APPLIED' as const,
          rejectedAt: null,
          rejectionNote: null,
        }),
        ...(dto.address && {
          address: {
            upsert: { create: { ...dto.address }, update: { ...dto.address } },
          },
        }),
      },
      include: { address: true },
    });
    return toSellerProfile(updated);
  }

  async listMyVerifications(
    sellerId: string,
  ): Promise<SellerVerificationRecord[]> {
    const verifications = await this.prisma.sellerVerification.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
    return verifications.map(toSellerVerification);
  }

  async uploadVerification(
    sellerId: string,
    documentType: string,
    files: VerificationFileLike[],
  ): Promise<SellerVerificationRecord[]> {
    if (files.length === 0) {
      throw new BadRequestException('At least one file is required.');
    }
    if (files.length > MAX_VERIFICATION_FILES) {
      throw new BadRequestException(
        `At most ${MAX_VERIFICATION_FILES} files may be uploaded at once.`,
      );
    }
    files.forEach(validateVerificationFile);

    const uploaded = await Promise.all(
      files.map((file) =>
        this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalname,
          mimetype: file.mimetype,
          directory: 'seller-verifications',
        }),
      ),
    );

    const created = await this.prisma.$transaction(
      uploaded.map((result) =>
        this.prisma.sellerVerification.create({
          data: { sellerId, documentType, documentUrl: result.url },
        }),
      ),
    );
    return created.map(toSellerVerification);
  }

  // --- Admin ---

  async adminList(query: AdminSellersQueryDto) {
    const statusFilter = ADMIN_STATUS_FILTER_MAP[query.status];
    const where: Prisma.SellerWhereInput = statusFilter
      ? { status: { in: statusFilter } }
      : {};

    const [total, sellers] = await this.prisma.$transaction([
      this.prisma.seller.count({ where }),
      this.prisma.seller.findMany({
        where,
        ...SELLER_ADMIN_INCLUDE,
        orderBy: { appliedAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: sellers.map(toAdminSellerRecord),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async adminGetDetail(id: string): Promise<AdminSellerRecord> {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });
    if (!seller) throw new NotFoundException('Seller not found.');
    return toAdminSellerRecord(seller);
  }

  /**
   * APPLIED/UNDER_REVIEW -> ACTIVE directly — APPROVED exists in the
   * schema for lifecycle completeness (and is real, addressable state a
   * future phase could pause at, e.g. pending a completed bank-account
   * setup) but this phase collapses straight through it: the brief's own
   * words ("Only approved/active sellers may sell") make the two
   * functionally equivalent for selling permission, and no described
   * trigger exists for a separate APPROVED -> ACTIVE step, so inventing
   * one here would be undescribed scope, not a real requirement.
   */
  async adminApprove(
    adminId: string,
    id: string,
    ipAddress?: string,
  ): Promise<AdminSellerRecord> {
    await this.transitionStatus(id, ['APPLIED', 'UNDER_REVIEW'], {
      status: 'ACTIVE',
      approvedAt: new Date(),
    });
    const updated = await this.prisma.seller.findUniqueOrThrow({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_APPROVED',
      resource: 'seller',
      resourceId: id,
      ipAddress,
    });
    const payload: SellerApprovedPayload = {
      sellerId: id,
      userId: updated.userId,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_APPROVED, payload);

    return toAdminSellerRecord(updated);
  }

  async adminReject(
    adminId: string,
    id: string,
    dto: RejectSellerDto,
    ipAddress?: string,
  ): Promise<AdminSellerRecord> {
    await this.transitionStatus(id, ['APPLIED', 'UNDER_REVIEW'], {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionNote: dto.reason,
    });
    const updated = await this.prisma.seller.findUniqueOrThrow({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_REJECTED',
      resource: 'seller',
      resourceId: id,
      metadata: { reason: dto.reason },
      ipAddress,
    });
    const payload: SellerRejectedPayload = {
      sellerId: id,
      userId: updated.userId,
      reason: dto.reason,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_REJECTED, payload);

    return toAdminSellerRecord(updated);
  }

  async adminSuspend(
    adminId: string,
    id: string,
    dto: SellerStatusNoteDto,
    ipAddress?: string,
  ): Promise<AdminSellerRecord> {
    await this.transitionStatus(id, ['ACTIVE'], {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      statusNote: dto.note,
    });
    const updated = await this.prisma.seller.findUniqueOrThrow({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_SUSPENDED',
      resource: 'seller',
      resourceId: id,
      metadata: { note: dto.note },
      ipAddress,
    });
    const payload: SellerSuspendedPayload = {
      sellerId: id,
      userId: updated.userId,
      note: dto.note,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_SUSPENDED, payload);

    return toAdminSellerRecord(updated);
  }

  /** SUSPENDED or DEACTIVATED -> ACTIVE — "reactivate/deactivate" is
   * listed as one paired admin capability in the governing brief; this is
   * the undo direction for either block. */
  async adminReactivate(
    adminId: string,
    id: string,
    ipAddress?: string,
  ): Promise<AdminSellerRecord> {
    await this.transitionStatus(id, ['SUSPENDED', 'DEACTIVATED'], {
      status: 'ACTIVE',
    });
    const updated = await this.prisma.seller.findUniqueOrThrow({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_REACTIVATED',
      resource: 'seller',
      resourceId: id,
      ipAddress,
    });
    const payload: SellerReactivatedPayload = {
      sellerId: id,
      userId: updated.userId,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_REACTIVATED, payload);

    return toAdminSellerRecord(updated);
  }

  async adminDeactivate(
    adminId: string,
    id: string,
    dto: SellerStatusNoteDto,
    ipAddress?: string,
  ): Promise<AdminSellerRecord> {
    await this.transitionStatus(id, ['ACTIVE', 'SUSPENDED'], {
      status: 'DEACTIVATED',
      deactivatedAt: new Date(),
      statusNote: dto.note,
    });
    const updated = await this.prisma.seller.findUniqueOrThrow({
      where: { id },
      ...SELLER_ADMIN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_DEACTIVATED',
      resource: 'seller',
      resourceId: id,
      metadata: { note: dto.note },
      ipAddress,
    });
    const payload: SellerDeactivatedPayload = {
      sellerId: id,
      userId: updated.userId,
      note: dto.note,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_DEACTIVATED, payload);

    return toAdminSellerRecord(updated);
  }

  /**
   * The shared atomic-conditional-update idiom this codebase uses
   * throughout (PaymentsService.confirmCapture, ReturnsService.
   * adminApprove/adminReject, ...): the WHERE clause's status check and
   * the UPDATE happen as one indivisible database operation, so two
   * concurrent admin actions on the same seller (e.g. one approving,
   * another rejecting, at the same instant) can never both succeed —
   * exactly the "be concurrency-safe" requirement the governing brief
   * states for every admin transition. The loser gets a real, honest 409
   * naming the row's actual current status, distinguished from a genuine
   * 404 for an id that doesn't exist at all.
   */
  private async transitionStatus(
    id: string,
    allowedFrom: SellerStatus[],
    data: Prisma.SellerUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await this.prisma.seller.updateMany({
      where: { id, status: { in: allowedFrom } },
      data,
    });
    if (count > 0) return;

    const existing = await this.prisma.seller.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Seller not found.');
    throw new ConflictException(
      `Seller is currently ${existing.status} and cannot make this transition.`,
    );
  }
}

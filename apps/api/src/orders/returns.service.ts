import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import {
  validateEvidenceFile,
  type EvidenceFileLike,
} from './evidence-file.util';
import {
  deriveClaimType,
  isReasonEligibleForClaimType,
  isWithinReturnWindow,
  requiresEvidence,
  type ReturnClaimType,
} from './return-policy.util';
import { RETURN_REASON_TO_DB, returnReasonToPublic } from './order.types';
import type { CreateReturnClaimDto } from './dto/create-return-claim.dto';
import type { ApproveReturnDto } from './dto/approve-return.dto';
import type { RejectReturnDto } from './dto/reject-return.dto';
import type { AdminReturnsQueryDto } from './dto/admin-returns-query.dto';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type {
  ReturnApprovedPayload,
  ReturnRejectedPayload,
} from '../notifications/notification.events';

/** DB enum -> public API string, both directions — covers every ReturnRequestStatus value, even the ones no code can reach yet (REFUND_ISSUED/STORE_CREDIT_ISSUED/REPLACEMENT_ISSUED are Phase 6D-4B+'s job), so the admin list/detail responses stay honest if a caller ever filters on one. */
const RETURN_STATUS_TO_PUBLIC: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUND_ISSUED: 'refund-issued',
  STORE_CREDIT_ISSUED: 'store-credit-issued',
  REPLACEMENT_ISSUED: 'replacement-issued',
};
const RETURN_STATUS_FROM_PUBLIC: Record<string, string> = Object.fromEntries(
  Object.entries(RETURN_STATUS_TO_PUBLIC).map(([db, pub]) => [pub, db]),
);

const ADMIN_RETURN_INCLUDE = {
  items: {
    include: {
      orderItem: {
        select: { name: true, price: true, quantity: true },
      },
    },
  },
  evidence: { select: { url: true, createdAt: true } },
  order: {
    select: {
      id: true,
      total: true,
      deliveredAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  storeCreditEntry: { select: { id: true } },
} satisfies Prisma.ReturnRequestInclude;

type AdminReturnRequestRow = Prisma.ReturnRequestGetPayload<{
  include: typeof ADMIN_RETURN_INCLUDE;
}>;

/**
 * Phase 6D-3 — customer-facing claim CREATION only. Everything downstream
 * of a claim actually existing (admin approval/rejection, refund
 * execution, store-credit issuance, replacement-order creation, reverse
 * logistics) is explicitly out of scope here — see
 * docs/PHASE_6D_MIGRATION_DESIGN.md. A newly created claim always starts
 * PENDING and touches nothing else: no Order.status change, no refund, no
 * store credit, no replacement order. Those are the admin-resolution
 * phase's job.
 */
@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  async createClaim(
    userId: string,
    orderId: string,
    dto: CreateReturnClaimDto,
    files: EvidenceFileLike[],
  ) {
    // Ownership is enforced by this WHERE clause itself, matching every
    // other OrdersService method's convention — never a separate
    // fetch-then-compare-userId check, which would be a real TOCTOU/
    // authorization gap (and the exact pattern that lets a customer only
    // ever see/act on their OWN orders, never another customer's).
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, returnRequest: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as unknown as {
      status: string;
      deliveredAt: Date | null;
      returnRequest: unknown;
      items: { id: string; categorySlug: string; quantity: number }[];
    };

    if (typedOrder.status !== 'DELIVERED') {
      throw new BadRequestException(
        'This order is not eligible for a return — it has not been delivered yet.',
      );
    }
    // A friendly, fast pre-check — ReturnRequest.orderId's own @unique
    // constraint (see the P2002 catch below) is the real, race-proof
    // guarantee that at most one claim can ever exist per order; this
    // check just avoids doing unnecessary evidence-upload work for a
    // request that's certain to be rejected anyway.
    if (typedOrder.returnRequest) {
      throw new BadRequestException(
        'A return or DOA claim already exists for this order.',
      );
    }

    const orderItemsById = new Map(
      typedOrder.items.map((item) => [item.id, item]),
    );
    const seenItemIds = new Set<string>();
    for (const line of dto.items) {
      if (seenItemIds.has(line.orderItemId)) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} was listed more than once in this claim.`,
        );
      }
      seenItemIds.add(line.orderItemId);

      const orderItem = orderItemsById.get(line.orderItemId);
      // Never trust a client-supplied orderItemId in isolation — it must
      // resolve to a real line item on THIS order (found via the map
      // built from `typedOrder.items`, which was itself scoped to this
      // order/user above), closing off both "an item that doesn't exist"
      // and "an item that belongs to someone else's order" the same way.
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} does not belong to this order.`,
        );
      }
      if (line.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero.');
      }
      if (line.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Cannot claim ${line.quantity} unit(s) of order item ${line.orderItemId} — only ${orderItem.quantity} were purchased on that line.`,
        );
      }
    }

    const selectedItems = dto.items.map((line) =>
      orderItemsById.get(line.orderItemId)!,
    );
    const claimType = deriveClaimType(
      selectedItems.map((item) => ({ categorySlug: item.categorySlug })),
    );
    if (claimType === 'MIXED') {
      throw new BadRequestException(
        'A single claim cannot mix plant and non-plant items — please file two separate claims.',
      );
    }

    const reasonDb = RETURN_REASON_TO_DB[dto.reason];
    if (!isReasonEligibleForClaimType(claimType, reasonDb)) {
      throw new BadRequestException(
        claimType === 'DOA_CLAIM'
          ? `Reason "${dto.reason}" is not valid for a plant DOA/damage claim.`
          : `Reason "${dto.reason}" is not valid for a standard return.`,
      );
    }

    if (!isWithinReturnWindow(claimType, typedOrder.deliveredAt)) {
      throw new BadRequestException(
        claimType === 'DOA_CLAIM'
          ? 'DOA/damage claims must be reported within 24 hours of delivery.'
          : 'This order is outside its 14-day return window.',
      );
    }

    if (requiresEvidence(claimType) && files.length === 0) {
      throw new BadRequestException(
        'Photo or video evidence is required for a DOA/damage claim.',
      );
    }

    // Validate every file BEFORE uploading any of them — fail fast rather
    // than storing files 1..k only to reject on file k+1.
    for (const file of files) {
      validateEvidenceFile(file);
    }

    // Uploads happen before the ReturnRequest row is created — Prisma's
    // nested `evidence: { create: [...] }` write needs the real stored
    // URLs ready at that point, and restructuring to create a bare
    // (evidence-less) row first, then attach evidence, then roll back on
    // upload failure would trade this gap for a worse one: a real window
    // where a PENDING DOA claim persists with no evidence at all,
    // visible to anything that reads ReturnRequest rows. Given that
    // trade-off, uploading first and cleaning up on any failure below is
    // the safer shape — see docs/PHASE_6D_MIGRATION_DESIGN.md.
    //
    // `uploaded` tracks exactly what THIS request's own upload calls
    // produced, so cleanup below can never touch a file belonging to a
    // different (successful) claim.
    const uploaded: { url: string; key: string }[] = [];
    try {
      for (const file of files) {
        const result = await this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalname,
          mimetype: file.mimetype,
          directory: 'return-evidence',
        });
        uploaded.push(result);
      }

      const created = await this.prisma.returnRequest.create({
        data: {
          orderId,
          claimType,
          reason: reasonDb,
          note: dto.note,
          status: 'PENDING',
          items: {
            create: dto.items.map((line) => ({
              orderItemId: line.orderItemId,
              quantity: line.quantity,
            })),
          },
          evidence: {
            create: uploaded.map((u) => ({ url: u.url })),
          },
        },
        include: { items: true, evidence: true },
      });

      return this.toPublicClaim(created, claimType, dto.reason);
    } catch (err) {
      // Anything that failed here — a storage error partway through the
      // upload loop, or the create() call itself — leaves behind
      // whatever this request DID successfully upload before failing,
      // with nothing in the database ever pointing at it. Best-effort:
      // failing to delete an orphan is logged and swallowed, never
      // allowed to replace or mask the real error below (a cleanup
      // failure must not turn a clean 400 concurrency rejection, or any
      // other real error, into an unrelated 500).
      await this.cleanupUploadedEvidence(uploaded.map((u) => u.key));

      // Two concurrent requests racing to create the ONE-AND-ONLY
      // ReturnRequest a given order can ever have (orderId is @unique —
      // a deliberate Phase 6D-1 design choice, see
      // docs/PHASE_6D_MIGRATION_DESIGN.md) collide here: Postgres commits
      // exactly one insert and rejects the other with a real constraint
      // violation. Caught and converted to the same clean 400 this
      // codebase already uses for the identical race on
      // CancellationRequest (OrdersService.requestCancellation) — never a
      // raw database error surfaced to the client.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A return or DOA claim already exists for this order.',
        );
      }
      throw err;
    }
  }

  /**
   * Best-effort only — see the doc comment at its call site above for why
   * a cleanup failure here must never propagate. `keys` is always this
   * one request's own upload results, never shared/global state, so this
   * can never delete a file another (successful) claim now references.
   */
  private async cleanupUploadedEvidence(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storageService.delete(key);
      } catch (err) {
        this.logger.warn(
          `Could not clean up orphaned evidence file ${key} after a lost/failed claim creation: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
  }

  private toPublicClaim(
    created: {
      id: string;
      orderId: string;
      status: string;
      note: string | null;
      requestedAt: Date;
      items: { orderItemId: string; quantity: number }[];
      evidence: { url: string }[];
    },
    claimType: ReturnClaimType,
    reason: string,
  ) {
    return {
      id: created.id,
      orderId: created.orderId,
      claimType: claimType === 'DOA_CLAIM' ? 'doa-claim' : 'standard-return',
      status: created.status.toLowerCase(),
      reason,
      note: created.note,
      items: created.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      evidence: created.evidence.map((e) => ({ url: e.url })),
      requestedAt: created.requestedAt.toISOString(),
    };
  }

  // --- Phase 6D-4A: admin queue, detail, approve/reject ---
  //
  // Deliberately does NOT execute any resolution here — approve/reject
  // only record the administrative decision (who, when, and — for a
  // rejection — why). Refund execution, store-credit issuance,
  // replacement-order creation, and reverse logistics are explicitly a
  // later phase's job (see docs/PHASE_6D_MIGRATION_DESIGN.md); nothing
  // below ever calls PaymentsService, StoreCreditEntry, or creates an
  // Order.

  /**
   * Defaults to the PENDING queue (see AdminReturnsQueryDto) — an admin
   * can pass another status to review already-decided claims, but "the
   * queue" itself is what needs action. Ordered oldest-first: unlike
   * every other list in this codebase (which shows newest-first), a work
   * queue's whole point is surfacing what's been waiting longest.
   */
  async adminListClaims(
    query: AdminReturnsQueryDto,
  ): Promise<{ items: unknown[]; total: number }> {
    const dbStatus = RETURN_STATUS_FROM_PUBLIC[query.status];
    const clampedPageSize = Math.min(query.pageSize, 50);
    const where = {
      status: dbStatus as Prisma.ReturnRequestWhereInput['status'],
    };

    const [rows, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: ADMIN_RETURN_INCLUDE,
        orderBy: { requestedAt: 'asc' },
        skip: (query.page - 1) * clampedPageSize,
        take: clampedPageSize,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return { items: rows.map((row) => this.toAdminRecord(row)), total };
  }

  async adminGetClaim(id: string) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });
    if (!row) throw new NotFoundException('Return request not found.');
    return this.toAdminRecord(row);
  }

  /**
   * PENDING -> APPROVED. The `updateMany` with a `status: 'PENDING'`
   * precondition is the same atomic-conditional-transition idiom this
   * codebase already established for PaymentsService.confirmCapture's
   * CREATED -> CAPTURED move and PaymentsService.expireStalePayments'
   * CREATED -> EXPIRED sweep: Postgres serializes concurrent UPDATEs to
   * the same row, so of two simultaneous approve/reject calls for the
   * same claim, exactly one's WHERE clause still matches (count: 1) and
   * commits; the other's matches nothing (count: 0) and is rejected
   * cleanly below — no explicit row lock needed, the same reasoning as
   * those two existing methods.
   */
  async adminApprove(
    adminId: string,
    id: string,
    dto: ApproveReturnDto,
    ipAddress?: string,
  ) {
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        decidedBy: adminId,
        decidedAt: new Date(),
        decisionNote: dto.note,
      },
    });
    if (count === 0) await this.rejectStaleDecision(id);

    const updated = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_APPROVED',
      resource: 'return_request',
      resourceId: id,
      metadata: { orderId: updated.orderId, note: dto.note ?? null },
      ipAddress,
    });

    const payload: ReturnApprovedPayload = {
      returnRequestId: id,
      orderId: updated.orderId,
      userId: updated.order.user.id,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.RETURN_APPROVED, payload);

    return this.toAdminRecord(updated);
  }

  /** PENDING -> REJECTED. Same atomic-transition/race-handling as adminApprove above. */
  async adminReject(
    adminId: string,
    id: string,
    dto: RejectReturnDto,
    ipAddress?: string,
  ) {
    const { count } = await this.prisma.returnRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedBy: adminId,
        decidedAt: new Date(),
        decisionNote: dto.reason,
      },
    });
    if (count === 0) await this.rejectStaleDecision(id);

    const updated = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: ADMIN_RETURN_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'RETURN_REJECTED',
      resource: 'return_request',
      resourceId: id,
      metadata: { orderId: updated.orderId, reason: dto.reason },
      ipAddress,
    });

    const payload: ReturnRejectedPayload = {
      returnRequestId: id,
      orderId: updated.orderId,
      userId: updated.order.user.id,
      reason: dto.reason,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.RETURN_REJECTED, payload);

    return this.toAdminRecord(updated);
  }

  /**
   * Shared by adminApprove/adminReject when their conditional update
   * matched zero rows — distinguishes "doesn't exist at all" (404) from
   * "exists, but already decided / not pending" (409, a genuine state
   * conflict — ConflictException, matching this codebase's existing
   * convention for that, e.g. AuthService's duplicate-email check).
   */
  private async rejectStaleDecision(id: string): Promise<never> {
    const existing = await this.prisma.returnRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Return request not found.');
    const currentPublic =
      RETURN_STATUS_TO_PUBLIC[existing.status] ?? existing.status.toLowerCase();
    throw new ConflictException(
      `This claim is already ${currentPublic} — only a pending claim can be approved or rejected.`,
    );
  }

  private toAdminRecord(row: AdminReturnRequestRow) {
    const claimType = row.claimType;
    const evidenceRequired = requiresEvidence(claimType);
    const reasonEligible = isReasonEligibleForClaimType(claimType, row.reason);

    return {
      id: row.id,
      orderId: row.orderId,
      status: RETURN_STATUS_TO_PUBLIC[row.status] ?? row.status.toLowerCase(),
      claimType: claimType === 'DOA_CLAIM' ? 'doa-claim' : 'standard-return',
      reason: returnReasonToPublic[row.reason],
      note: row.note,
      requestedAt: row.requestedAt.toISOString(),
      order: {
        id: row.order.id,
        total: Number(row.order.total),
        deliveredAt: row.order.deliveredAt
          ? row.order.deliveredAt.toISOString()
          : null,
      },
      customer: {
        id: row.order.user.id,
        firstName: row.order.user.firstName,
        lastName: row.order.user.lastName,
        email: row.order.user.email,
      },
      items: row.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        productName: item.orderItem.name,
        unitPrice: Number(item.orderItem.price),
        purchasedQuantity: item.orderItem.quantity,
        claimedLineValue: Number(item.orderItem.price) * item.quantity,
      })),
      evidence: row.evidence.map((e) => ({
        url: e.url,
        uploadedAt: e.createdAt.toISOString(),
      })),
      policy: {
        evidenceRequired,
        evidenceProvided: row.evidence.length > 0,
        reasonEligible,
      },
      decision: {
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
        decisionNote: row.decisionNote,
      },
      // Always empty/null in Phase 6D-4A (nothing here ever sets them) —
      // surfaced anyway so the admin UI can see at a glance that no
      // resolution has been executed yet, and so this shape doesn't need
      // to change once a later phase starts populating them.
      resolution: {
        resolutionType: row.resolutionType,
        requiresReverseLogistics: row.requiresReverseLogistics,
        refundAmount: row.refundAmount ? Number(row.refundAmount) : null,
        refundId: row.refundId,
        replacementOrderId: row.replacementOrderId,
        storeCreditEntryId: row.storeCreditEntry?.id ?? null,
      },
    };
  }
}
